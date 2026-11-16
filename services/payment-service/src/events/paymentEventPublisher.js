
import amqp from "amqplib";

const EXCHANGE_NAME = "hotel.events";

let connection = null;
let channel = null;
let connectionPromise = null;

// Serializes publishes so mandatory-return correlation is unambiguous.
let publishQueue = Promise.resolve();

export const connectPaymentEventPublisher = async () => {
  if (channel) {
    return channel;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const rabbitUrl = process.env.RABBITMQ_URL;

    if (!rabbitUrl) {
      throw new Error("RABBITMQ_URL is not configured");
    }

    const newConnection = await amqp.connect(rabbitUrl);

    try {
      const newChannel = await newConnection.createConfirmChannel();

      await newChannel.assertExchange(EXCHANGE_NAME, "topic", {
        durable: true,
      });

      const invalidate = () => {
        if (connection !== newConnection) {
          return;
        }

        connection = null;
        channel = null;
      };

      newConnection.on("error", (error) => {
        console.error("RabbitMQ connection error:", error.message);
        invalidate();
      });

      newConnection.on("close", invalidate);

      newChannel.on("error", (error) => {
        console.error("RabbitMQ channel error:", error.message);
        invalidate();
      });

      newChannel.on("close", invalidate);

      connection = newConnection;
      channel = newChannel;

      return newChannel;
    } catch (error) {
      await newConnection.close().catch(() => {});
      throw error;
    }
  })();

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
};

const publishOne = async (event) => {
  const {
    eventId,
    eventType,
    payload,
  } = event ?? {};

  const routingKey = payload?.routingKey;

  if (
    typeof eventId !== "string" ||
    !eventId ||
    typeof eventType !== "string" ||
    !eventType ||
    typeof routingKey !== "string" ||
    !routingKey
  ) {
    throw new Error("Invalid payment outbox event");
  }

  const message = { ...payload };
  delete message.routingKey;

  const body = Buffer.from(JSON.stringify(message));

  const publisherChannel = await connectPaymentEventPublisher();

  await new Promise((resolve, reject) => {
    let returned = false;

    const onReturn = (returnedMessage) => {
      if (returnedMessage.properties.messageId === eventId) {
        returned = true;
      }
    };

    publisherChannel.on("return", onReturn);

    try {
      publisherChannel.publish(
        EXCHANGE_NAME,
        routingKey,
        body,
        {
          persistent: true,
          mandatory: true,
          contentType: "application/json",
          messageId: eventId,
          type: eventType,
          timestamp: Date.now(),
        },
        (error) => {
          publisherChannel.removeListener("return", onReturn);

          if (error) {
            reject(error);
            return;
          }

          if (returned) {
            const err = new Error(
              `RabbitMQ could not route event ${eventId} (${routingKey})`
            );
            err.code = "UNROUTABLE_RETURN";
            err.routingKey = routingKey;
            reject(err);
            return;
          }

          resolve();
        }
      );
    } catch (error) {
      publisherChannel.removeListener("return", onReturn);
      reject(error);
    }
  });
};

export const publishPaymentEvent = (event) => {
  const currentPublish = publishQueue.then(
    () => publishOne(event),
    () => publishOne(event)
  );

  // Keep the queue usable even if one publication fails.
  publishQueue = currentPublish.catch(() => {});

  return currentPublish;
};

export const closePaymentEventPublisher = async () => {
  // Wait for already queued publications before closing resources.
  await publishQueue;

  const currentChannel = channel;
  const currentConnection = connection;

  channel = null;
  connection = null;

  try {
    if (currentChannel) {
      await currentChannel.close();
    }
  } catch (error) {
    console.error("Error closing RabbitMQ channel:", error.message);
  }

  try {
    if (currentConnection) {
      await currentConnection.close();
    }
  } catch (error) {
    console.error("Error closing RabbitMQ connection:", error.message);
  }
};
