import mongoose from "mongoose";

let isConnected = false; // Global connection flag

const connectDB = async () => {
  if (isConnected) {
    console.log("🔁 Using existing MongoDB connection");
    return;
  }

  try {
    const db = await mongoose.connect(`${process.env.MONGODB_URI}/project0`
);

    isConnected = db.connections[0].readyState === 1; // 1 means connected
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};

export default connectDB;
