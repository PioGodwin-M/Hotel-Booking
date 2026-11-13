
import amqp from "amqplib";
import { randomUUID } from "node:crypto";

import { processPaymentResult } from "./paymentResultHandler.js";

const EVENT_EXCHANGE = "hotel.events";
const RETRY_EXCHANGE = "booking.payment.retry";
const RETURN_EXCHANGE = "booking.payment.return";
const DLX_EXCHANGE = "booking.payment.dlx";

const MAIN_QUEUE = "booking.payment-results";
const RETRY_QUEUE = "booking.payment-results-retry";
const DLQ_QUEUE = "booking.payment-results-dlq";

const ROUTING_KEY = "payment-results";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

let connection = null;
let consumerChannel = null;
let retryChannel = null;

let reconnectTimer = null;
let reconnectDelay = 1000;
let shuttingDown = false;
let connecting = false;

const scheduleReconnect = () => {
  if (reconnectTimer || shuttingDown) return;

  const delay = reconnectDelay;

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectRabbitMQ();
  }, delay);

  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
};

const handleConnectionLoss = async (lostConnection) => {
  if (connection !== lostConnection) return;

  connection = null;
  consumerChannel = null;
  retryChannel = null;

  try {
    await lostConnection.close();
  } catch {
    // Connection may already be closed.
  }

  if (!shuttingDown) {
    scheduleReconnect();
  }
};

const connectRabbitMQ = async () => {
  if (connection && consumerChannel && retryChannel) return;
  if (connecting || shuttingDown) return;

  connecting = true;

  let newConnection;
  let newConsumerChannel;
  let newRetryChannel;

  try {
    const url = process.env.RABBITMQ_URL;

    if (!url) {
      throw new Error("RABBITMQ_URL is not configured");
    }

    newConnection = await amqp.connect(url);

    newConnection.on("error", (error) => {
      console.error(
        "Payment consumer connection error:",
        error.message
      );
    });

    newConnection.on("close", () => {
      if (connection === newConnection) {
        connection = null;
        consumerChannel = null;
        retryChannel = null;

        if (!shuttingDown) scheduleReconnect();
      }
    });

    newConsumerChannel = await newConnection.createChannel();
    newRetryChannel = await newConnection.createConfirmChannel();

    await newConsumerChannel.assertExchange(
      EVENT_EXCHANGE,
      "topic",
      { durable: true }
    );

    await newConsumerChannel.assertExchange(
      RETRY_EXCHANGE,
      "direct",
      { durable: true }
    );

    await newConsumerChannel.assertExchange(
      RETURN_EXCHANGE,
      "direct",
      { durable: true }
    );

    await newConsumerChannel.assertExchange(
      DLX_EXCHANGE,
      "direct",
      { durable: true }
    );

    await newConsumerChannel.assertQueue(MAIN_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": DLX_EXCHANGE,
        "x-dead-letter-routing-key": ROUTING_KEY,
      },
    });

    await newConsumerChannel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: {
        "x-message-ttl": RETRY_DELAY_MS,
        "x-dead-letter-exchange": RETURN_EXCHANGE,
        "x-dead-letter-routing-key": ROUTING_KEY,
      },
    });

    await newConsumerChannel.assertQueue(DLQ_QUEUE, {
      durable: true,
    });

    await newConsumerChannel.bindQueue(
      MAIN_QUEUE,
      EVENT_EXCHANGE,
      "payment.succeeded"
    );

    await newConsumerChannel.bindQueue(
      MAIN_QUEUE,
      EVENT_EXCHANGE,
      "payment.failed"
    );

    await newConsumerChannel.bindQueue(
      MAIN_QUEUE,
      RETURN_EXCHANGE,
      ROUTING_KEY
    );

    await newConsumerChannel.bindQueue(
      RETRY_QUEUE,
      RETRY_EXCHANGE,
      ROUTING_KEY
    );

    await newConsumerChannel.bindQueue(
      DLQ_QUEUE,
      DLX_EXCHANGE,
      ROUTING_KEY
    );

    await newConsumerChannel.prefetch(10);
    
    if (shuttingDown) {
  await Promise.allSettled([
    newConsumerChannel.close(),
    newRetryChannel.close(),
  ]);

  await newConnection.close();
  return;
}

    connection = newConnection;
    consumerChannel = newConsumerChannel;
    retryChannel = newRetryChannel;

    reconnectDelay = 1000;

    // A channel failure requires rebuilding the connection and
    // both channels, not just replacing one global reference.
    const onChannelFailure = (error) => {
      if (error) {
        console.error("Payment consumer channel error:", error.message);
      }

      void handleConnectionLoss(newConnection);
    };

    newConsumerChannel.on("error", onChannelFailure);
    newConsumerChannel.on("close", () => onChannelFailure());

    newRetryChannel.on("error", onChannelFailure);
    newRetryChannel.on("close", () => onChannelFailure());

    await newConsumerChannel.consume(
      MAIN_QUEUE,
      (message) =>
        handlePaymentMessage(
          message,
          newConsumerChannel,
          newRetryChannel
        ),
      { noAck: false }
    );

    console.log("Payment result consumer connected to RabbitMQ");
  } catch (error) {
    console.error(
      "Payment result consumer connection failed:",
      error.message
    );

    // Clean up locally created resources even if they were never
    // assigned to the shared connection variables.
    await Promise.allSettled([
      newConsumerChannel?.close(),
      newRetryChannel?.close(),
    ]);

    try {
      await newConnection?.close();
    } catch {
      // Already closed.
    }

    if (!shuttingDown) scheduleReconnect();
  } finally {
    connecting = false;
  }
};

const publishForRetry = async (message, publisherChannel) => {
  if (!publisherChannel) {
    throw new Error("RabbitMQ retry publisher is unavailable");
  }

  const retryCorrelationId = randomUUID();

  let returned = false;

  const onReturn = (returnedMessage) => {
    if (
      returnedMessage.properties.correlationId === retryCorrelationId
    ) {
      returned = true;
    }
  };

  publisherChannel.on("return", onReturn);

  try {
    const headers = {
      ...(message.properties.headers || {}),
      "x-retry-count": Number(
        message.properties.headers?.["x-retry-count"] || 0
      ) + 1,
    };

    await new Promise((resolve, reject) => {
      publisherChannel.publish(
        RETRY_EXCHANGE,
        ROUTING_KEY,
        message.content,
        {
          persistent: true,
          mandatory: true,
          contentType: "application/json",
          messageId: message.properties.messageId,
          correlationId: retryCorrelationId,
          headers,
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          if (returned) {
            reject(
              new Error("RabbitMQ could not route retry message")
            );
            return;
          }

          resolve();
        }
      );
    });
  } finally {
    publisherChannel.removeListener("return", onReturn);
  }
};

const handlePaymentMessage = async (
  message,
  deliveryChannel,
  publisherChannel
) => {
  if (!message) return;

  try {
    const event = JSON.parse(message.content.toString("utf8"));

    const outcome = await processPaymentResult(event);

    console.log(
      `Payment event ${event.eventId} processed: ${outcome}`
    );

    // Acknowledge using the exact channel that delivered the message.
    deliveryChannel.ack(message);
  } catch (error) {
    console.error(
      "Payment event processing failed:",
      error.message
    );

    const retryCount = Number(
      message.properties.headers?.["x-retry-count"] || 0
    );

    if (retryCount < MAX_RETRIES) {
      try {
        // Publish and confirm the retry before acknowledging the
        // original message.
        await publishForRetry(message, publisherChannel);

        deliveryChannel.ack(message);
      } catch (publishError) {
        console.error(
          "Could not publish payment event for retry:",
          publishError.message
        );

        try {
          deliveryChannel.nack(message, false, true);
        } catch {
          // If the channel is already closed, RabbitMQ will
          // requeue the unacknowledged delivery.
        }
      }

      return;
    }

    try {
      deliveryChannel.nack(message, false, false);
    } catch {
      // A closed channel will cause unacknowledged delivery recovery.
    }
  }
};

const closeConnections = async () => {
  const currentConsumerChannel = consumerChannel;
  const currentRetryChannel = retryChannel;
  const currentConnection = connection;

  consumerChannel = null;
  retryChannel = null;
  connection = null;

  await Promise.allSettled([
    currentConsumerChannel?.close(),
    currentRetryChannel?.close(),
  ]);

  try {
    await currentConnection?.close();
  } catch {
    // Already closed.
  }
};

export const startPaymentResultConsumer = async () => {
  shuttingDown = false;
  await connectRabbitMQ();
};

export const closePaymentResultConsumer = async () => {
  shuttingDown = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  await closeConnections();

  console.log("Payment result consumer stopped");
};
