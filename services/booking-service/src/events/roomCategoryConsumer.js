
import amqp from "amqplib";
import mongoose from "mongoose";

import ProcessedEvent from "../models/ProcessedEvent.js";
import RoomInventory from "../models/RoomInventory.js";

// RabbitMQ configuration
const EXCHANGE_NAME = "hotel.events";

const MAIN_QUEUE = "booking.room-category-created";
const RETRY_QUEUE = "booking.room-category-retry";
const DLQ_QUEUE = "booking.room-category-dlq";

const RETRY_EXCHANGE = "booking.retry";
const DLQ_EXCHANGE = "booking.dlx";

const ROUTING_KEY = "catalog.room-category.created";

const MAX_RETRIES = 3;
const RETRY_DELAY = 10000;

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

// Connection state
let connection = null;
let consumerChannel = null;
let retryPublisherChannel = null;

let reconnectTimer = null;
let reconnectAttempts = 0;

let shuttingDown = false;
let connecting = false;

// --------------------------------------------------
// 1. Process event transactionally
// --------------------------------------------------

const processRoomCategoryEvent = async (event) => {
  const { eventId, eventType, payload } = event;

  if (
    !eventId ||
    eventType !== "RoomCategoryCreated" ||
    !payload?.roomCategoryId ||
    !payload?.hotelId ||
    !Number.isInteger(payload?.totalUnits) ||
    payload.totalUnits < 1
  ) {
    throw new Error("Invalid RoomCategoryCreated event");
  }

  if (
    !mongoose.isValidObjectId(payload.roomCategoryId) ||
    !mongoose.isValidObjectId(payload.hotelId)
  ) {
    throw new Error("Invalid room category or hotel ID");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {

      // Record the event ID.
      await ProcessedEvent.create(
        [
          {
            eventId,
            eventType,
          },
        ],
        { session }
      );

      // Create inventory only if it does not exist.
      await RoomInventory.updateOne(
        {
          roomCategoryId: payload.roomCategoryId,
        },
        {
          $setOnInsert: {
            roomCategoryId: payload.roomCategoryId,
            hotelId: payload.hotelId,
            totalUnits: payload.totalUnits,
            isActive: true,
          },
        },
        {
          upsert: true,
          session,
        }
      );
    });

  } finally {
    await session.endSession();
  }
};

// --------------------------------------------------
// 2. Check duplicate event
// --------------------------------------------------

const isAlreadyProcessed = async (eventId) => {
  return Boolean(
    await ProcessedEvent.exists({ eventId })
  );
};

// --------------------------------------------------
// 3. Declare RabbitMQ infrastructure
// --------------------------------------------------

const setupRabbitMQInfrastructure = async (channel) => {

  await channel.assertExchange(
    EXCHANGE_NAME,
    "topic",
    { durable: true }
  );

  await channel.assertExchange(
    RETRY_EXCHANGE,
    "direct",
    { durable: true }
  );

  await channel.assertExchange(
    DLQ_EXCHANGE,
    "direct",
    { durable: true }
  );

  // Dead-letter queue
  await channel.assertQueue(DLQ_QUEUE, {
    durable: true,
  });

  await channel.bindQueue(
    DLQ_QUEUE,
    DLQ_EXCHANGE,
    "room-category-failed"
  );

  // Retry queue
  await channel.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: {
      "x-message-ttl": RETRY_DELAY,
      "x-dead-letter-exchange": EXCHANGE_NAME,
      "x-dead-letter-routing-key": ROUTING_KEY,
    },
  });

  await channel.bindQueue(
    RETRY_QUEUE,
    RETRY_EXCHANGE,
    "room-category-retry"
  );

  // Main queue
  await channel.assertQueue(MAIN_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": DLQ_EXCHANGE,
      "x-dead-letter-routing-key": "room-category-failed",
    },
  });

  await channel.bindQueue(
    MAIN_QUEUE,
    EXCHANGE_NAME,
    ROUTING_KEY
  );

  await channel.prefetch(1);
};

// --------------------------------------------------
// 4. Publish failed event to retry queue
// --------------------------------------------------

const publishRetry = async (
  message,
  retryCount,
  publisherChannel
) => {

  publisherChannel.publish(
    RETRY_EXCHANGE,
    "room-category-retry",
    Buffer.from(message.content),
    {
      persistent: true,
      contentType: "application/json",
      messageId: message.properties.messageId,
      headers: {
        ...(message.properties.headers || {}),
        "x-retry-count": retryCount + 1,
      },
    }
  );

  // Wait for RabbitMQ confirmation.
  await publisherChannel.waitForConfirms();
};

// --------------------------------------------------
// 5. Handle incoming messages
// --------------------------------------------------

const handleMessage = async (
  message,
  currentConsumerChannel,
  currentPublisherChannel
) => {
  if (!message) return;

  try {
    const event = JSON.parse(
      message.content.toString()
    );

    await processRoomCategoryEvent(event);

    // ACK after database transaction commits.
    currentConsumerChannel.ack(message);

    console.log(
      `Successfully processed event: ${event.eventId}`
    );

  } catch (error) {

    let event = null;

    try {
      event = JSON.parse(
        message.content.toString()
      );
    } catch {
      event = null;
    }

    // Handle duplicate event IDs.
    if (error.code === 11000 && event?.eventId) {
      try {
        const alreadyProcessed =
          await isAlreadyProcessed(event.eventId);

        if (alreadyProcessed) {
          currentConsumerChannel.ack(message);

          console.log(
            `Duplicate event ignored: ${event.eventId}`
          );

          return;
        }
      } catch (verificationError) {
        console.error(
          "Duplicate verification failed:",
          verificationError.message
        );
      }
    }

    const headers = message.properties.headers || {};

    const retryCount = Number(
      headers["x-retry-count"] || 0
    );

    console.error(
      "Event processing failed:",
      error.message
    );

    if (retryCount < MAX_RETRIES) {

      try {
        await publishRetry(
          message,
          retryCount,
          currentPublisherChannel
        );

        // ACK original only after retry confirmation.
        currentConsumerChannel.ack(message);

        console.log(
          `Retry ${retryCount + 1}/${MAX_RETRIES} scheduled`
        );

      } catch (publishError) {
        console.error(
          "Retry publishing failed:",
          publishError.message
        );

        // Leave the message unacknowledged.
        // Closing the channel causes RabbitMQ to
        // redeliver its unacknowledged messages.
        try {
          await currentConsumerChannel.close();
        } catch {
          // Channel may already be closed.
        }
      }

    } else {

      // Reject without requeue.
      // RabbitMQ routes the message to the DLQ.
      currentConsumerChannel.nack(
        message,
        false,
        false
      );

      console.error(
        "Retry limit exceeded. Message sent to DLQ."
      );
    }
  }
};

// --------------------------------------------------
// 6. Schedule reconnection
// --------------------------------------------------

const scheduleReconnect = () => {
  if (shuttingDown || reconnectTimer) return;

  const delay = Math.min(
    INITIAL_RECONNECT_DELAY *
      Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );

  reconnectAttempts++;

  console.log(
    `RabbitMQ reconnect scheduled in ${delay} ms`
  );

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    try {
      await connectAndConsume();
    } catch (error) {
      console.error(
        "RabbitMQ reconnection failed:",
        error.message
      );

      scheduleReconnect();
    }
  }, delay);
};

// --------------------------------------------------
// 7. Establish connection and start consumer
// --------------------------------------------------

const connectAndConsume = async () => {
  if (shuttingDown || connecting) return;

  if (connection && consumerChannel && retryPublisherChannel) {
    return;
  }

  connecting = true;

  try {
    const url = process.env.RABBITMQ_URL;

    if (!url) {
      throw new Error("RABBITMQ_URL is not configured");
    }

    const newConnection = await amqp.connect(url);

    connection = newConnection;

    newConnection.on("error", (error) => {
      console.error(
        "RabbitMQ connection error:",
        error.message
      );
    });

    newConnection.on("close", () => {
      if (connection !== newConnection) return;

      console.error("RabbitMQ connection closed");

      connection = null;
      consumerChannel = null;
      retryPublisherChannel = null;

      scheduleReconnect();
    });

    const newConsumerChannel =
      await newConnection.createChannel();

    const newPublisherChannel =
      await newConnection.createConfirmChannel();

    consumerChannel = newConsumerChannel;
    retryPublisherChannel = newPublisherChannel;

    await setupRabbitMQInfrastructure(
      newConsumerChannel
    );

    await newConsumerChannel.consume(
      MAIN_QUEUE,
      (message) => {
        if (!message) return;

        handleMessage(
          message,
          newConsumerChannel,
          newPublisherChannel
        ).catch((error) => {
          console.error(
            "Unexpected consumer error:",
            error.message
          );

          // Close channel to recover unacknowledged messages.
          newConsumerChannel.close().catch(() => {});
        });
      },
      {
        noAck: false,
      }
    );

    reconnectAttempts = 0;

    console.log(
      "Booking Service RabbitMQ consumer connected"
    );

  } catch (error) {

    // Clean up partial connection setup.
    if (connection) {
      try {
        await connection.close();
      } catch {
        // Connection may already be closed.
      }
    }

    connection = null;
    consumerChannel = null;
    retryPublisherChannel = null;

    throw error;

  } finally {
    connecting = false;
  }
};

// --------------------------------------------------
// 8. Public startup function
// --------------------------------------------------

export const startRoomCategoryConsumer = async () => {
  shuttingDown = false;

  try {
    await connectAndConsume();
  } catch (error) {
    console.error(
      "Initial RabbitMQ connection failed:",
      error.message
    );

    // Booking Service can remain available while
    // RabbitMQ reconnects in the background.
    scheduleReconnect();
  }
};

// --------------------------------------------------
// 9. Graceful shutdown
// --------------------------------------------------

export const closeRoomCategoryConsumer = async () => {
  shuttingDown = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const currentConsumerChannel = consumerChannel;
  const currentPublisherChannel = retryPublisherChannel;
  const currentConnection = connection;

  consumerChannel = null;
  retryPublisherChannel = null;
  connection = null;

  if (currentConsumerChannel) {
    await currentConsumerChannel.close().catch(() => {});
  }

  if (currentPublisherChannel) {
    await currentPublisherChannel.close().catch(() => {});
  }

  if (currentConnection) {
    await currentConnection.close().catch(() => {});
  }

  console.log(
    "Booking Service RabbitMQ consumer stopped"
  );
};
