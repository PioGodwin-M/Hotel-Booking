
import mongoose from "mongoose";

const connectDatabase = async () => {
  const { MONGODB_URI, DB_NAME } = process.env;

  if (!MONGODB_URI || !DB_NAME) {
    throw new Error(
      "MONGODB_URI and DB_NAME must be configured"
    );
  }

  await mongoose.connect(MONGODB_URI, {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`User Service connected to MongoDB: ${DB_NAME}`);
};

export default connectDatabase;
