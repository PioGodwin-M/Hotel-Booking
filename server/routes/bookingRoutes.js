import express from "express"
import { checkAvailabilityAPI, createBooking, getHotelBooking, getUserBookings } from "../controller/bookingController";
import { protect } from "../middleware/authMiddleware";
const bookingRouter=express.Router();
bookingRouter.get('/check-availability',checkAvailabilityAPI);
bookingRouter.post('/book',protect,createBooking);
bookingRouter.get('/user',protect,getUserBookings);
bookingRouter.get('/hotel',protect,getHotelBooking);
export default bookingRouter