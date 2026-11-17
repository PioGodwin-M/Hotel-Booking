import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "hotel_catalog";

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined in environment");
  process.exit(1);
}

async function connect() {
  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
}

/**
 * Apply: Additive schema initialization.
 * Sets default locationPrecision: 'exact' and null coordinates on existing hotels missing them.
 * Does not create unnecessary indexes or modify existing data.
 */
export async function apply() {
  await connect();
  const db = mongoose.connection.db;
  const collection = db.collection("hotels");

  console.log("Applying migration: 20261117_add_property_location...");

  const updateResult = await collection.updateMany(
    { locationPrecision: { $exists: false } },
    {
      $set: {
        latitude: null,
        longitude: null,
        locationPrecision: "exact",
        area: null,
      },
    }
  );
  console.log(`Updated ${updateResult.modifiedCount} existing hotels with location defaults.`);

  await mongoose.disconnect();
  console.log("Migration applied successfully.");
}

/**
 * Rollback: Reverses schema additions.
 *
 * SAFETY WARNING:
 * Unsets latitude, longitude, locationPrecision, and area across all hotel documents.
 * Any coordinates entered by owners after the initial migration WILL BE PERMANENTLY LOST.
 *
 * PREREQUISITE:
 * You MUST take a complete MongoDB backup of the 'hotels' collection before running rollback.
 * To prevent accidental data loss, the CLI requires the '--force-data-loss' flag.
 */
export async function rollback(force = false) {
  if (!force) {
    throw new Error(
      "REFUSING DESTRUCTIVE ROLLBACK: Unsetting location fields will destroy coordinates entered by owners. " +
        "Ensure a full database backup is taken first, then pass '--force-data-loss' to proceed."
    );
  }

  await connect();
  const db = mongoose.connection.db;
  const collection = db.collection("hotels");

  console.log("Rolling back migration: 20261117_add_property_location (forced)...");

  const updateResult = await collection.updateMany(
    {},
    {
      $unset: {
        latitude: "",
        longitude: "",
        locationPrecision: "",
        area: "",
      },
    }
  );
  console.log(`Unset location fields on ${updateResult.modifiedCount} hotels.`);

  await mongoose.disconnect();
  console.log("Migration rolled back successfully.");
}

// CLI runner
if (process.argv[1] === __filename) {
  const command = process.argv[2];
  const force = process.argv.includes("--force-data-loss");

  if (command === "apply") {
    apply()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
      });
  } else if (command === "rollback") {
    rollback(force)
      .then(() => process.exit(0))
      .catch((err) => {
        console.error("Rollback aborted:", err.message);
        process.exit(1);
      });
  } else {
    console.log("Usage: node src/migrations/20261117_add_property_location.js [apply|rollback] [--force-data-loss]");
    process.exit(1);
  }
}
