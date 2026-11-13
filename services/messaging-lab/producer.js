
import amqp from "amqplib";

const RABBITMQ_URL =
  "amqp://hotel_admin:local_dev_password@localhost:5672";

async function publishMessage() {
  let connection;

  try {
    // 1. Establish TCP connection
    connection = await amqp.connect(RABBITMQ_URL);

    // 2. Create logical channel
    const channel = await connection.createChannel();

    // 3. Declare queue
    const queue = "booking_queue";

    await channel.assertQueue(queue, {
      durable: true
    });

    // 4. Create message
    const message = {
      eventId: "evt_001",
      eventType: "BookingCreated",
      bookingId: "booking_101",
      customerId: "user_101",
      amount: 5000
    };

    // 5. Publish message
    channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true
      }
    );

    console.log("Message published:", message);

    await channel.close();

  } catch (error) {
    console.error("Producer error:", error);

  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

publishMessage();
