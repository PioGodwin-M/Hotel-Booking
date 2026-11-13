
import amqp from "amqplib";
import { randomUUID } from "node:crypto";

const EXCHANGE = "hotel.events";
const MAIN_QUEUE = "notification.booking-events";

const DLQ_EXCHANGE = "notification.dlx";
const DLQ_QUEUE = "notification.booking-events.dlq";

const RETRY_EXCHANGE = "notification.retry";
const RETRY_DELAY_MS = 10000;

const DEAD_ROUTING_KEY =
  "notification.booking-events.dead";

const EVENT_ROUTING_KEYS = [
  "booking.confirmed",
  "booking.cancelled",
  "booking.payment-failed",
  "booking.expired",
];

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

let connection = null;
let consumerChannel = null;
let publisherChannel = null;

let connectionPromise = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

let isShuttingDown = false;
let consumerSetupHandler = null;

let connectionGeneration = 0;

const assertTopology = async (channel) => {
  await channel.assertExchange(EXCHANGE, "topic", {
    durable: true,
  });

  await channel.assertExchange(DLQ_EXCHANGE, "direct", {
    durable: true,
  });

  await channel.assertQueue(DLQ_QUEUE, {
    durable: true,
  });

  await channel.bindQueue(
    DLQ_QUEUE,
    DLQ_EXCHANGE,
    DEAD_ROUTING_KEY
  );

  await channel.assertExchange(RETRY_EXCHANGE, "direct", {
    durable: true,
  });

  await channel.assertQueue(MAIN_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": DLQ_EXCHANGE,
      "x-dead-letter-routing-key": DEAD_ROUTING_KEY,
    },
  });

  for (const routingKey of EVENT_ROUTING_KEYS) {
    await channel.bindQueue(
      MAIN_QUEUE,
      EXCHANGE,
      routingKey
    );

    const retryQueue = `notification.retry.${routingKey}`;

    await channel.assertQueue(retryQueue, {
      durable: true,
      arguments: {
        "x-message-ttl": RETRY_DELAY_MS,
        "x-dead-letter-exchange": EXCHANGE,
        "x-dead-letter-routing-key": routingKey,
      },
    });

    await channel.bindQueue(
      retryQueue,
      RETRY_EXCHANGE,
      routingKey
    );
  }

  console.log("Notification RabbitMQ topology ready");
};

const clearReconnectTimer = () => {
  if (!reconnectTimer) return;

  clearTimeout(reconnectTimer);
  reconnectTimer = null;
};

const clearActiveResources = (expectedConnection = null) => {
  if (
    expectedConnection &&
    connection !== expectedConnection
  ) {
    return false;
  }

  connection = null;
  consumerChannel = null;
  publisherChannel = null;

  connectionGeneration += 1;

  return true;
};

const scheduleReconnect = () => {
  if (
    isShuttingDown ||
    reconnectTimer ||
    connectionPromise
  ) {
    return;
  }

  const delay = Math.min(
    INITIAL_RECONNECT_DELAY_MS *
      2 ** reconnectAttempts,
    MAX_RECONNECT_DELAY_MS
  );

  reconnectAttempts += 1;

  console.warn(
    `Notification RabbitMQ reconnect scheduled in ${delay} ms`
  );

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    if (isShuttingDown) return;

    try {
      await connectRabbitMQ();
    } catch (error) {
      console.error(
        "Notification RabbitMQ reconnection failed:",
        error.message
      );

      scheduleReconnect();
    }
  }, delay);
};

const handleConnectionFailure = (
  failedConnection,
  error
) => {
  if (isShuttingDown) return;

  // Ignore events from an obsolete connection.
  if (connection !== failedConnection) return;

  if (error) {
    console.error(
      "Notification RabbitMQ connection failure:",
      error.message
    );
  }

  clearActiveResources(failedConnection);

  scheduleReconnect();
};

const createConnection = async () => {
  if (isShuttingDown) {
    throw new Error(
      "Notification Service is shutting down"
    );
  }

  const rabbitConnection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  if (isShuttingDown) {
    await rabbitConnection.close().catch(() => {});
    throw new Error(
      "Notification Service is shutting down"
    );
  }

  connection = rabbitConnection;

  const generation = ++connectionGeneration;

  const handleFailure = (error) => {
    if (connection !== rabbitConnection) return;

    handleConnectionFailure(
      rabbitConnection,
      error
    );
  };

  rabbitConnection.on("error", (error) => {
    console.error(
      "Notification RabbitMQ connection error:",
      error.message
    );
  });

  rabbitConnection.on("close", () => {
    console.warn(
      "Notification RabbitMQ connection closed"
    );

    handleFailure();
  });

  let newConsumerChannel = null;
  let newPublisherChannel = null;

  try {
    newConsumerChannel =
      await rabbitConnection.createChannel();

    newPublisherChannel =
      await rabbitConnection.createConfirmChannel();

    if (
      isShuttingDown ||
      connection !== rabbitConnection ||
      generation !== connectionGeneration
    ) {
      throw new Error(
        "RabbitMQ connection became obsolete during setup"
      );
    }

    const channelFailure = (error) => {
      if (connection !== rabbitConnection) return;

      handleConnectionFailure(
        rabbitConnection,
        error
      );
    };

    newConsumerChannel.on("error", (error) => {
      console.error(
        "Notification consumer channel error:",
        error.message
      );
    });

    newConsumerChannel.on("close", () => {
      console.warn(
        "Notification consumer channel closed"
      );

      channelFailure();
    });

    newPublisherChannel.on("error", (error) => {
      console.error(
        "Notification publisher channel error:",
        error.message
      );
    });

    newPublisherChannel.on("close", () => {
      console.warn(
        "Notification publisher channel closed"
      );

      channelFailure();
    });

    await newConsumerChannel.prefetch(10);

    await assertTopology(newConsumerChannel);

    if (
      isShuttingDown ||
      connection !== rabbitConnection ||
      generation !== connectionGeneration
    ) {
      throw new Error(
        "RabbitMQ connection became obsolete during topology setup"
      );
    }

    consumerChannel = newConsumerChannel;
    publisherChannel = newPublisherChannel;

    // Reattach the consumer once per successfully created connection.
    if (consumerSetupHandler) {
      await consumerSetupHandler(consumerChannel);
    }

    if (
      isShuttingDown ||
      connection !== rabbitConnection ||
      generation !== connectionGeneration
    ) {
      throw new Error(
        "RabbitMQ connection became obsolete during consumer setup"
      );
    }

    reconnectAttempts = 0;

    console.log(
      "Notification Service connected to RabbitMQ"
    );

    return consumerChannel;
  } catch (error) {
    if (connection === rabbitConnection) {
      clearActiveResources(rabbitConnection);
    }

    await rabbitConnection.close().catch(() => {});

    throw error;
  }
};

export const connectRabbitMQ = async () => {
  if (isShuttingDown) {
    throw new Error(
      "Notification Service is shutting down"
    );
  }

  if (
    connection &&
    consumerChannel &&
    publisherChannel
  ) {
    return consumerChannel;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  clearReconnectTimer();

  connectionPromise = createConnection()
    .catch((error) => {
      connection = null;
      consumerChannel = null;
      publisherChannel = null;

      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};

export const registerConsumerSetupHandler = (handler) => {
  if (typeof handler !== "function") {
    throw new TypeError(
      "Consumer setup handler must be a function"
    );
  }

  consumerSetupHandler = handler;
};

export const getRabbitChannel = () => {
  if (!consumerChannel) {
    throw new Error(
      "RabbitMQ consumer channel is not connected"
    );
  }

  return consumerChannel;
};

export const getRabbitPublisherChannel = () => {
  if (!publisherChannel) {
    throw new Error(
      "RabbitMQ publisher channel is not connected"
    );
  }

  return publisherChannel;
};

export const publishMandatoryAndConfirm = async (
  exchange,
  routingKey,
  content,
  options = {}
) => {
  const channel = getRabbitPublisherChannel();

  const publishAttemptId = randomUUID();

  let returnedMessage = null;

  const headers = {
    ...(options.headers || {}),
    "x-publish-attempt-id": publishAttemptId,
  };

  const onReturn = (message) => {
    const returnedAttemptId =
      message.properties.headers?.["x-publish-attempt-id"];

    if (returnedAttemptId === publishAttemptId) {
      returnedMessage = message;
    }
  };

  channel.on("return", onReturn);

  try {
    channel.publish(
      exchange,
      routingKey,
      content,
      {
        ...options,
        headers,
        mandatory: true,
      }
    );

    await channel.waitForConfirms();

    if (returnedMessage) {
      throw new Error(
        `RabbitMQ returned an unroutable message: ${exchange}/${routingKey}`
      );
    }
  } finally {
    channel.removeListener("return", onReturn);
  }
};

export const closeRabbitMQ = async () => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  clearReconnectTimer();

  // Invalidate any connection setup still in progress.
  connectionGeneration += 1;

  const currentConnection = connection;

  connection = null;
  consumerChannel = null;
  publisherChannel = null;

  if (currentConnection) {
    await currentConnection.close().catch(() => {});
  }

  // Wait for any pending connection setup to settle.
  if (connectionPromise) {
    await connectionPromise.catch(() => {});
  }

  console.log(
    "Notification Service RabbitMQ disconnected"
  );
};
