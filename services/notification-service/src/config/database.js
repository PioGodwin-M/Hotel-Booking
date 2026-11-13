
import mongoose from "mongoose";

const connectDatabase = async () => {
  try {
    const connection = await mongoose.connect(
      process.env.MONGODB_URI,
      {
        dbName: process.env.DB_NAME || "hotel_notification",
        serverSelectionTimeoutMS: 5000,
      }
    );

    console.log("Notification Service: MongoDB connected");
    console.log(`Database: ${connection.connection.name}`);

    return connection;
  } catch (error) {
    console.error(
      "Notification Service MongoDB connection failed:",
      error.message
    );

    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    console.log("Notification Service MongoDB disconnected");
  } catch (error) {
    console.error("MongoDB disconnection failed:", error.message);
    throw error;
  }
};

export default connectDatabase;
