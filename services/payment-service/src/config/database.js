import mongoose from "mongoose";

const connectDatabase = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not configured");
    }

    if (!process.env.DB_NAME) {
      throw new Error("DB_NAME is not configured");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME,
    });

    console.log("Payment Service: MongoDB connected");
    console.log(`Database: ${process.env.DB_NAME}`);
  } catch (error) {
    console.error(
      "Payment Service database connection failed:",
      error.message
    );

    throw error;
  }
};

export default connectDatabase;