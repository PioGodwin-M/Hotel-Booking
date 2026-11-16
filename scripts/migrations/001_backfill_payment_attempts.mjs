import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const mongoose = require(path.join(__dirname, "../../services/payment-service/node_modules/mongoose"));
const dotenv = require(path.join(__dirname, "../../services/payment-service/node_modules/dotenv"));

dotenv.config({ path: path.join(__dirname, "../../services/payment-service/.env") });

export const up = async () => {
  console.log("Connecting to MongoDB for migration 001_backfill_payment_attempts...");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME });
  const db = mongoose.connection.db;

  try {
    console.log("1. Inspecting existing 'payments' collection...");
    const payments = await db.collection("payments").find({}).sort({ createdAt: 1 }).toArray();
    console.log(`Found ${payments.length} documents in 'payments'.`);

    // Group by bookingId to preserve attempt history sequentially if multiples exist
    const paymentsByBooking = new Map();
    for (const p of payments) {
      const bKey = p.bookingId.toString();
      if (!paymentsByBooking.has(bKey)) paymentsByBooking.set(bKey, []);
      paymentsByBooking.get(bKey).push(p);
    }

    let paymentsUpdated = 0;
    for (const [bKey, list] of paymentsByBooking.entries()) {
      for (let i = 0; i < list.length; i++) {
        const doc = list[i];
        const attemptNum = doc.attemptNumber || (i + 1);
        const attemptId = doc.attemptId || `att_${bKey}_${attemptNum}`;
        const refundStatus = doc.refundStatus || "NONE";
        const refundedAmountMinor = doc.refundedAmountMinor || 0;

        await db.collection("payments").updateOne(
          { _id: doc._id },
          {
            $set: {
              attemptNumber: attemptNum,
              attemptId: attemptId,
              refundStatus: refundStatus,
              refundedAmountMinor: refundedAmountMinor,
            },
          }
        );
        paymentsUpdated++;
      }
    }
    console.log(`✓ Backfilled ${paymentsUpdated} documents in 'payments'.`);

    console.log("2. Inspecting existing 'paymentrequests' collection...");
    const requests = await db.collection("paymentrequests").find({}).sort({ createdAt: 1 }).toArray();
    console.log(`Found ${requests.length} documents in 'paymentrequests'.`);

    let requestsUpdated = 0;
    for (const req of requests) {
      const bKey = req.bookingId ? req.bookingId.toString() : "";
      // Correlate with corresponding payment if available
      const matchingPayment = payments.find(p => p.paymentId === req.paymentId);
      const attemptNum = req.attemptNumber || matchingPayment?.attemptNumber || 1;
      const attemptId = req.attemptId || `att_${bKey}_${attemptNum}`;

      await db.collection("paymentrequests").updateOne(
        { _id: req._id },
        {
          $set: {
            attemptNumber: attemptNum,
            attemptId: attemptId,
          },
        }
      );
      requestsUpdated++;
    }
    console.log(`✓ Backfilled ${requestsUpdated} documents in 'paymentrequests'.`);

    console.log("3. Creating compound unique indexes...");
    await db.collection("payments").createIndex(
      { bookingId: 1, attemptNumber: 1 },
      { unique: true, name: "unique_booking_payment_attempt" }
    );
    console.log("✓ Created index 'unique_booking_payment_attempt' on 'payments'");

    await db.collection("paymentrequests").createIndex(
      { bookingId: 1, attemptNumber: 1 },
      { unique: true, name: "unique_booking_attempt_reservation" }
    );
    console.log("✓ Created index 'unique_booking_attempt_reservation' on 'paymentrequests'");

    console.log("Migration 001_backfill_payment_attempts completed successfully.");
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1]?.endsWith("001_backfill_payment_attempts.mjs")) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
