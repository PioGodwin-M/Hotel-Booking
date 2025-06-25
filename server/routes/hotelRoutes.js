import express from "express"
import { protect } from "../middleware/authMiddleware.js";
import { registerHotel } from "../controller/hotelControler.js";
const hotelRouter=express();
hotelRouter.post('/',protect,registerHotel);
export default hotelRouter