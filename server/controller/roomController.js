import Hotel from "../models/hotel.js";
import { v2 as cloudinary } from "cloudinary";
import Room from "../models/room.js";
//API to create a new room to hotel
export const createRoom= async(req,res)=>{
 try{
      const {roomType,pricePerNight,amenities}=req.body;
      const hotel=await Hotel.findOne({owner:req.auth.userId});
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
          const hotelData=await Hotel({owner:req.auth.userid})
          const rooms=await Room.find({hotel:hotelData._id.toString()}).populate("hotel");
          res.json({success:true,rooms});
        }
        catch(error){
          res.json({success:false,message:error.message});
        }
}
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
