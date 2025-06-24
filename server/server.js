import express from "express"
import "dotenv/config"
import cors from "cors"
import connectDB from "./config/db.js";
import { clerkMiddleware } from '@clerk/express'
import clerkWebhooks from "./controller/clerkWebhooks.js";
connectDB()
const app=express();

app.use(cors())//Enable cross origin resource sharing

//middleware
app.use(express.json)
app.use(clerkMiddleware())

// API to Clerk Webhooks
app.get('/api/clerk',clerkWebhooks);

app.get('/',(req,res)=> res.send("API is Working is fine"))

const port=process.env.port || 3000;

app.listen(port,()=>console.log("Running"))