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

export async function apply() {
  await connect();
  const db = mongoose.connection.db;
  const collection = db.collection("hotels");

  console.log("Applying migration: 20261117_remove_unused_location_index...");

  try {
    await collection.dropIndex("latitude_1_longitude_1_sparse");
    console.log("Successfully dropped index 'latitude_1_longitude_1_sparse' without touching any data.");
  } catch (err) {
    if (err.code === 27 || err.message?.includes("index not found")) {
      console.log("Index 'latitude_1_longitude_1_sparse' does not exist in the database.");
    } else {
      throw err;
    }
  }

  await mongoose.disconnect();
  console.log("Migration applied successfully.");
}

export async function rollback() {
  await connect();
  const db = mongoose.connection.db;
  const collection = db.collection("hotels");

  console.log("Rolling back migration: recreating 'latitude_1_longitude_1_sparse'...");

  await collection.createIndex(
    { latitude: 1, longitude: 1 },
    { sparse: true, name: "latitude_1_longitude_1_sparse" }
  );
  console.log("Recreated sparse index 'latitude_1_longitude_1_sparse'.");

  await mongoose.disconnect();
  console.log("Rollback completed successfully.");
}

// CLI runner
if (process.argv[1] === __filename) {
  const command = process.argv[2];
  if (command === "apply") {
    apply()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
      });
  } else if (command === "rollback") {
    rollback()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error("Rollback failed:", err);
        process.exit(1);
      });
  } else {
    console.log("Usage: node src/migrations/20261117_remove_unused_location_index.js [apply|rollback]");
    process.exit(1);
  }
}
