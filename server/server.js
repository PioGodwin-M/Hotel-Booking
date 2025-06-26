import express from "express"
import "dotenv/config"
import cors from "cors"
import connectDB from "./config/db.js";
import { clerkMiddleware } from '@clerk/express'
import clerkWebhooks from "./controller/clerkWebhooks.js";
import userRoutes from "./routes/userRoutes.js";
import hotelRouter from "./routes/hotelRoutes.js";
import connectCloudinary from "./config/cloudinary.js";
import roomRouter from "./routes/roomRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import bodyParser from "body-parser";
connectDB();
connectCloudinary();
const app=express();

app.use(cors())//Enable cross origin resource sharing

//middleware

app.use(clerkMiddleware())

// API to Clerk Webhooks
app.post('/api/clerk', bodyParser.raw({ type: "application/json" }),
  clerkWebhooks);
app.use(express.json())
app.get('/',(req,res)=> res.send("API is Working is fine"))
app.use('/api/user',userRoutes)
app.use('/api/hotels',hotelRouter)
app.use('api/rooms',roomRouter)
app.use('/api/bookings',bookingRouter)

const PORT=process.env.port || 3000;

app.listen(PORT,()=>console.log("Running"))