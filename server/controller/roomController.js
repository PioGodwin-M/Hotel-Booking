import Hotel from "../models/hotel.js";
import { v2 as cloudinary } from "cloudinary";
import Room from "../models/room.js";
//API to create a new room to hotel
export const createRoom= async(req,res)=>{
 try{
      const {roomType,pricePerNight,amenities}=req.body;
      const hotel=await Hotel.findOne({owner:req.auth().userId});
      if(!hotel) return res.json({
        success:false,message:"Hotel Not Available"
      });
      //Upload img to cloudinary
      const uploadImages=req.files.map(async(file)=>{
          const response=await cloudinary.uploader.upload(file.path);
          return response.secure_url;
      })
      const images=await Promise.all(uploadImages);
      await Room.create({
        hotel:hotel._id,
        roomType,
        pricePerNight: +pricePerNight,
        amenities:JSON.parse(amenities),
        images
      });
      res.json({success:true,message:"Room Created SuccessFully"});
   }
   catch(error){
    res.json({success:false,message:error.message});
   }

}
//
export const getRoom= async(req,res)=>{
        try{
             const rooms=await Room.find({isAvailable:true}).populate({
              path:"hotel",
              populate:{
                path:"owner",
                select:"image"
              }
             }).sort({createdAt:-1})
             res.json({success:true,rooms})          
        }
        catch(error){
          res.json({success:false,message:error.message});
        }
}
export const getOwnerRoom= async(req,res)=>{
        try{
          const hotelData=await Hotel.findOne({owner:req.auth().userId})
          const rooms=await Room.find({hotel:hotelData._id.toString()}).populate("hotel");
          res.json({success:true,rooms});
        }
        catch(error){
          res.json({success:false,message:error.message});
        }
}
export const getDashboardData = async (req, res) => {
  try {
    // find hotel owned by the logged-in user
    const hotel = await Hotel.findOne({ owner: req.auth().userId });
    if (!hotel) {
      return res.json({ success: false, message: "Hotel not found" });
    }

    // find rooms for this hotel
    const rooms = await Room.find({ hotel: hotel._id }).select("_id");

    // fetch bookings for these rooms
    const bookings = await Booking.find({ room: { $in: rooms.map(r => r._id) } })
      .populate("room")
      .populate("user", "name email"); // if you want guest details

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((acc, b) => acc + b.totalPrice, 0);

    res.json({
      success: true,
      bookings,
      totalBookings,
      totalRevenue,
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
export const toggleRoomAvailability= async(req,res)=>{
        try{
          const {roomId}=req.body;
          const roomData=await Room.findById(roomId);
          roomData.isAvailable=!roomData.isAvailable;
          await roomData.save();
          res.json({success:true,message:"Room availability Updated"});
        }
        catch(error){
          res.json({success:false,message:"Room availability not Updated"});
        }
}
