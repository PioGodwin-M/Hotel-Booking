
import amqp from "amqplib";
import { randomUUID } from "node:crypto";

const EVENT_EXCHANGE = "hotel.events";

let connection = null;
let channel = null;
let connectionPromise = null;

const connect = async () => {
  if (channel) return channel;

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const url = process.env.RABBITMQ_URL;

    if (!url) {
      throw new Error("RABBITMQ_URL is not configured");
    }

    const newConnection = await amqp.connect(url);
    const newChannel = await newConnection.createConfirmChannel();

    await newChannel.assertExchange(
      EVENT_EXCHANGE,
      "topic",
      { durable: true }
    );

    newConnection.on("error", (error) => {
      console.error(
        "Booking outbox RabbitMQ connection error:",
        error.message
      );
    });

    newConnection.on("close", () => {
      if (connection === newConnection) {
        connection = null;
        channel = null;
      }
    });

    newChannel.on("error", (error) => {
      console.error(
        "Booking outbox publisher channel error:",
        error.message
      );
    });

    newChannel.on("close", () => {
      if (channel === newChannel) {
        channel = null;
      }
    });

    connection = newConnection;
    channel = newChannel;

    return newChannel;
  })();

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
};

export const publishBookingEvent = async (outboxEvent) => {
  const publisherChannel = await connect();

  const correlationId = randomUUID();

  let returned = false;

  const onReturn = (message) => {
    if (message.properties.correlationId === correlationId) {
      returned = true;
    }
  };

  publisherChannel.on("return", onReturn);

  try {
    await new Promise((resolve, reject) => {
      publisherChannel.publish(
        EVENT_EXCHANGE,
        outboxEvent.routingKey,
        Buffer.from(JSON.stringify(outboxEvent.payload)),
        {
          persistent: true,
          mandatory: true,
          contentType: "application/json",
          messageId: outboxEvent.eventId,
          correlationId,
          type: outboxEvent.eventType,
          timestamp: Date.now(),
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          if (returned) {
            reject(
              new Error(
                `Unroutable booking event: ${outboxEvent.eventId}`
              )
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

export const closeBookingOutboxPublisher = async () => {
  const currentChannel = channel;
  const currentConnection = connection;

  channel = null;
  connection = null;

  try {
    await currentChannel?.close();
  } catch {
    // Channel may already be closed.
  }

  try {
    await currentConnection?.close();
  } catch {
    // Connection may already be closed.
  }
};
