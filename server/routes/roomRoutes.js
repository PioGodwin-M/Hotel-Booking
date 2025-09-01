import express from "express"
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { createRoom, getOwnerRoom, toggleRoomAvailability ,getDashboardData } from "../controller/roomController.js";
import { getRoom } from "../controller/roomController.js";
const roomRouter=express();
roomRouter.post('/',upload.array("images",4),protect,createRoom)
roomRouter.get('/',getRoom)
roomRouter.get('/owner',protect,getOwnerRoom)
roomRouter.get('/dashboard',protect,getDashboardData)
roomRouter.post('/toggle-availability',protect,toggleRoomAvailability)
export default roomRouter