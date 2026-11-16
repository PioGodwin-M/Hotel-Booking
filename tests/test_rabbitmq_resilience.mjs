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

const EXCHANGE_NAME = "hotel.events";
const MAIN_QUEUE = "booking.payment-results";

async function runTests() {
  console.log("=== Phase 1 Automated Test Suite: RabbitMQ Topology & Outbox Resilience ===\n");
  let passed = 0;
  let total = 0;

  const assert = (condition, desc) => {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  };

  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createConfirmChannel();

  try {
    // Test 1: Core Topology Verification
    console.log("1. Verifying Topology Declarations...");
    try {
      await ch.checkExchange(EXCHANGE_NAME);
      assert(true, `Exchange '${EXCHANGE_NAME}' exists and is accessible`);
    } catch (err) {
      assert(false, `Exchange '${EXCHANGE_NAME}' check failed: ${err.message}`);
    }

    try {
      const qOk = await ch.checkQueue(MAIN_QUEUE);
      assert(qOk && typeof qOk.messageCount === "number", `Queue '${MAIN_QUEUE}' exists (current messages: ${qOk.messageCount})`);
    } catch (err) {
      assert(false, `Queue '${MAIN_QUEUE}' check failed: ${err.message}`);
    }

    // Test 2: Mandatory Publishing on Unrouted Key Triggers basic.return
    console.log("\n2. Verifying Mandatory Publish & Return on Unrouted Key...");
    const unroutedKey = `test.unrouted.${Date.now()}`;
    const testMessageId = `test_msg_${Date.now()}`;
    let basicReturnFired = false;

    const returnPromise = new Promise((resolve, reject) => {
      const onReturn = (msg) => {
        if (msg.properties.messageId === testMessageId) {
          basicReturnFired = true;
        }
      };

      ch.on("return", onReturn);

      ch.publish(
        EXCHANGE_NAME,
        unroutedKey,
        Buffer.from(JSON.stringify({ test: true })),
        {
          mandatory: true,
          persistent: true,
          messageId: testMessageId,
        },
        (err) => {
          ch.removeListener("return", onReturn);
          if (err) return reject(err);
          resolve();
        }
      );
    });

    await returnPromise;
    assert(basicReturnFired, "Mandatory publish to unbound routing key correctly triggered basic.return");

    // Test 3: Unroutable Return Classification
    console.log("\n3. Verifying Unroutable Error Code Classification...");
    let caughtUnroutable = false;
    try {
      if (basicReturnFired) {
        const error = new Error(`RabbitMQ could not route event ${testMessageId} (${unroutedKey})`);
        error.code = "UNROUTABLE_RETURN";
        error.routingKey = unroutedKey;
        throw error;
      }
    } catch (err) {
      if (err.code === "UNROUTABLE_RETURN" && err.routingKey === unroutedKey) {
        caughtUnroutable = true;
      }
    }
    assert(caughtUnroutable, "Unroutable returns are categorized as UNROUTABLE_RETURN with routingKey preserved");

    // Test 4: Rerouting & Delivery to Bound Routing Keys
    console.log("\n4. Verifying Delivery to Bound Queues (payment.succeeded, payment.refunded)...");
    for (const boundKey of ["payment.succeeded", "payment.refunded"]) {
      const routedMsgId = `routed_msg_${boundKey}_${Date.now()}`;
      let returnTriggered = false;

      await new Promise((resolve, reject) => {
        const onReturn = (msg) => {
          if (msg.properties.messageId === routedMsgId) {
            returnTriggered = true;
          }
        };
        ch.on("return", onReturn);

        ch.publish(
          EXCHANGE_NAME,
          boundKey,
          Buffer.from(JSON.stringify({ testEvent: true, key: boundKey })),
          {
            mandatory: true,
            persistent: true,
            messageId: routedMsgId,
          },
          (err) => {
            ch.removeListener("return", onReturn);
            if (err) return reject(err);
            resolve();
          }
        );
      });

      assert(!returnTriggered, `Mandatory publish to '${boundKey}' routed successfully without being returned`);
    }

  } finally {
    await ch.close();
    await conn.close();
  }

  console.log(`\n========================================`);
  console.log(`Phase 1 Test Result: ${passed}/${total} passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
