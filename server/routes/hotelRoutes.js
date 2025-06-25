import express from "express"
const hotelRouter=express();
hotelRouter.post('/',protect,registerHotel);
export default hotelRouter