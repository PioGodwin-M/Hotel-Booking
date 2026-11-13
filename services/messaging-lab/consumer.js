
import amqp from "amqplib";

const RABBITMQ_URL =
  "amqp://hotel_admin:local_dev_password@localhost:5672";

async function startConsumer() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  const queue = "booking_queue";

  await channel.assertQueue(queue, {
    durable: true
  });

  // Process one unacknowledged message at a time
  await channel.prefetch(1);

  console.log("Waiting for booking events...");

  await channel.consume(queue, async (msg) => {
    if (msg === null) return;

    try {
      const booking = JSON.parse(msg.content.toString());

      console.log("Received booking:", booking);

      // Simulate business processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log("Booking processed successfully");

      // Acknowledge successful processing
      channel.ack(msg);

    } catch (error) {
      console.error("Processing failed:", error);

      // Requeue the message for redelivery
      channel.nack(msg, false, true);
    }
  }, {
    noAck: false
  });
}

startConsumer().catch(console.error);
