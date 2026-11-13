import mongoose from "mongoose";

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME,
    });

    console.log("Catalog Service: MongoDB connected");
    console.log(`Database: ${process.env.DB_NAME}`);
  } catch (error) {
    console.error("Catalog database connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDatabase;