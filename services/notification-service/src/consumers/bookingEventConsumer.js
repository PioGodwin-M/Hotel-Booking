
import {
  connectRabbitMQ,
  publishMandatoryAndConfirm,
  registerConsumerSetupHandler,
} from "../config/rabbitmq.js";

import {
  handleBookingEvent,
} from "../events/notificationEventHandler.js";

const MAIN_QUEUE = "notification.booking-events";
const RETRY_EXCHANGE = "notification.retry";

const MAX_RETRIES = 3;

let consumerTag = null;
let activeConsumerChannel = null;
let isStarted = false;
let isStopping = false;

// Serialize retry publications through the confirm channel.
// This also ensures the mandatory-return correlation helper
// has only one retry publication in flight at a time.
let retryPublishChain = Promise.resolve();

const publishRetry = async (
  message,
  routingKey,
  retryCount
) => {
  const publishOperation = async () => {
    const options = {
      persistent: true,
      contentType: "application/json",
      headers: {
        ...message.properties.headers,
        "x-retry-count": retryCount,
      },
      messageId: message.properties.messageId,
      correlationId: message.properties.correlationId,
      type: message.properties.type,
    };

    await publishMandatoryAndConfirm(
      RETRY_EXCHANGE,
      routingKey,
      message.content,
      options
    );
  };

  const operation = retryPublishChain.then(
    publishOperation,
    publishOperation
  );

  retryPublishChain = operation.catch(() => {});

  return operation;
};

const processMessage = async (channel, message) => {
  if (!message) return;

  try {
    const event = JSON.parse(
      message.content.toString("utf8")
    );

    await handleBookingEvent(event);

    // ACK only after the notification job is persisted.
    channel.ack(message);
  } catch (error) {
    console.error(
      "Booking event processing failed:",
      error.message
    );

    const retryCount =
      Number(
        message.properties.headers?.["x-retry-count"]
      ) || 0;

    if (retryCount < MAX_RETRIES) {
      try {
        await publishRetry(
          message,
          message.fields.routingKey,
          retryCount + 1
        );

        // ACK the original only after the retry publication
        // is confirmed and not returned as unroutable.
        if (channel === activeConsumerChannel) {
          channel.ack(message);
        }

        console.log(
          `Booking event retry scheduled: ${retryCount + 1}`
        );
      } catch (retryError) {
        console.error(
          "Retry publication failed:",
          retryError.message
        );

        // Do not ACK the original when retry publication fails.
        // RabbitMQ will redeliver it.
        if (channel === activeConsumerChannel) {
          channel.nack(message, false, true);
        }
      }

      return;
    }

    console.error(
      `Maximum retries exhausted for event: ${
        message.properties.messageId || "unknown"
      }`
    );

    // Main queue DLX routes this message to the notification DLQ.
    if (channel === activeConsumerChannel) {
      channel.nack(message, false, false);
    }
  }
};

const attachConsumer = async (channel) => {
  if (isStopping || !isStarted) return;

  if (activeConsumerChannel === channel && consumerTag) {
    return;
  }

  consumerTag = null;
  activeConsumerChannel = channel;

  const result = await channel.consume(
    MAIN_QUEUE,
    (message) => {
      if (!message) return;

      processMessage(channel, message).catch((error) => {
        console.error(
          "Unhandled consumer processing error:",
          error.message
        );
      });
    },
    {
      noAck: false,
    }
  );

  // A shutdown or reconnect may have happened while consume awaited.
  if (isStopping || activeConsumerChannel !== channel) {
    await channel.cancel(result.consumerTag).catch(() => {});
    return;
  }

  consumerTag = result.consumerTag;

  console.log("Notification booking event consumer attached");
};

export const startBookingEventConsumer = async () => {
  if (isStarted) return;

  isStopping = false;
  isStarted = true;

  registerConsumerSetupHandler(attachConsumer);

  try {
    const channel = await connectRabbitMQ();

    await attachConsumer(channel);
  } catch (error) {
    isStarted = false;
    throw error;
  }
};

export const closeBookingEventConsumer = async () => {
  if (!isStarted) return;

  isStopping = true;
  isStarted = false;

  const channel = activeConsumerChannel;
  const tag = consumerTag;

  consumerTag = null;
  activeConsumerChannel = null;

  if (channel && tag) {
    await channel.cancel(tag).catch(() => {});
  }

  console.log("Notification booking event consumer stopped");
};
