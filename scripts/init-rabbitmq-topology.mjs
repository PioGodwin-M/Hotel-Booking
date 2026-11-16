import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const amqp = require(path.join(__dirname, "../services/payment-service/node_modules/amqplib"));
const dotenv = require(path.join(__dirname, "../services/payment-service/node_modules/dotenv"));

dotenv.config({ path: path.join(__dirname, "../services/payment-service/.env") });

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://hotel_admin:local_dev_password@localhost:5672";

const EVENT_EXCHANGE = "hotel.events";
const RETRY_EXCHANGE = "booking.payment.retry";
const RETURN_EXCHANGE = "booking.payment.return";
const DLX_EXCHANGE = "booking.payment.dlx";

const MAIN_QUEUE = "booking.payment-results";
const RETRY_QUEUE = "booking.payment-results-retry";
const DLQ_QUEUE = "booking.payment-results-dlq";

const ROUTING_KEY = "payment-results";
const RETRY_DELAY_MS = 10000;

export const initRabbitMQTopology = async (customUrl) => {
  const url = customUrl || RABBITMQ_URL;
  console.log(`Connecting to RabbitMQ at ${url} for topology initialization...`);

  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  try {
    // 1. Core Event Topic Exchange
    await channel.assertExchange(EVENT_EXCHANGE, "topic", {
      durable: true,
    });
    console.log(`✓ Asserted exchange: ${EVENT_EXCHANGE} (topic)`);

    // 2. Dead-letter and Retry Exchanges
    await channel.assertExchange(RETRY_EXCHANGE, "direct", { durable: true });
    await channel.assertExchange(RETURN_EXCHANGE, "direct", { durable: true });
    await channel.assertExchange(DLX_EXCHANGE, "direct", { durable: true });
    console.log(`✓ Asserted DLQ & retry exchanges: ${RETRY_EXCHANGE}, ${RETURN_EXCHANGE}, ${DLX_EXCHANGE}`);

    // 3. Queues
    await channel.assertQueue(MAIN_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": DLX_EXCHANGE,
        "x-dead-letter-routing-key": ROUTING_KEY,
      },
    });

    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: {
        "x-message-ttl": RETRY_DELAY_MS,
        "x-dead-letter-exchange": RETURN_EXCHANGE,
        "x-dead-letter-routing-key": ROUTING_KEY,
      },
    });

    await channel.assertQueue(DLQ_QUEUE, {
      durable: true,
    });
    console.log(`✓ Asserted queues: ${MAIN_QUEUE}, ${RETRY_QUEUE}, ${DLQ_QUEUE}`);

    // 4. Bindings
    await channel.bindQueue(MAIN_QUEUE, EVENT_EXCHANGE, "payment.succeeded");
    await channel.bindQueue(MAIN_QUEUE, EVENT_EXCHANGE, "payment.failed");
    await channel.bindQueue(MAIN_QUEUE, EVENT_EXCHANGE, "payment.refunded");
    await channel.bindQueue(MAIN_QUEUE, EVENT_EXCHANGE, "payment.refund-failed");
    await channel.bindQueue(MAIN_QUEUE, EVENT_EXCHANGE, "payment.refund.*");
    await channel.bindQueue(MAIN_QUEUE, EVENT_EXCHANGE, "payment.disputed");
    await channel.bindQueue(MAIN_QUEUE, EVENT_EXCHANGE, "payment.dispute.*");
    await channel.bindQueue(MAIN_QUEUE, RETURN_EXCHANGE, ROUTING_KEY);
    await channel.bindQueue(RETRY_QUEUE, RETRY_EXCHANGE, ROUTING_KEY);
    await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, ROUTING_KEY);
    console.log(`✓ Established all queue bindings to ${EVENT_EXCHANGE} and retry exchanges`);

    console.log("RabbitMQ topology initialized successfully.");
  } finally {
    await channel.close();
    await connection.close();
  }
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith("init-rabbitmq-topology.mjs")) {
  initRabbitMQTopology()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Topology initialization failed:", err);
      process.exit(1);
    });
}
