// Function to check Availability of room
import Booking from "../models/booking.js"
import Room from "../models/room";
import Hotel from "../models/hotel.js";

const checkAvailability= async({checkInDate,checkOutDate,room})=>{
    try{
      const bookings=await Booking.find({
        room,
        checkInDate:{$lte:checkOutDate},
        checkOutDate:{$gte:checkInDate},
      });
      const isAvailable=bookings.length===0;
      return isAvailable;
    }
    catch(error){
        console.error(error.message);
    }
}

// API to check Availability of room

export const checkAvailabilityAPI=async(req,res)=>{
    try{
         const {room,checkInDate,checkOutDate}=req.body;
         const isAvailable=await checkAvailability({checkInDate,checkOutDate,room});
         res.json({success:true,isAvailable});
    }
    catch(error){
       res.json({succes:false,message:error.message});
    }
}

// API to create a new booking

export const createBooking= async(req,res)=>{
    try{
            const{room,checkInDate,checkOutDate,guests}=req.body;
            const user=req.user._id;
            // brfore booking check availabilty
            const isAvailable=await checkAvailability({checkInDate,checkOutDate,room});
            if(!isAvailable){
                res.json({succes:false,message:"Room is Not Available"});
            }
            const roomData=await Room.findById(room).populate("hotel");
            let totalPrice=roomData.pricePerNight;
            //Calculate total price
            const checkIn=new Date(checkInDate);
            const checkOut=new Date(checkOutDate);
            const timeDiff=checkOut.getTime()-checkOut.getTime();
            const nights=Math.ceil(timeDiff/(1000*3600*24))
            totalPrice*=nights;
            const booking=await Booking.create({
                user,
                room,
                hotel:roomData.hotel._id,
                guests:+guests,
                checkInDate,
                checkOutDate,
                totalPrice
            })
            res.json({succes:true,message:"Booking Created Successfully"})
    }
    catch(error){
        res.json({succes:false,message:error.message});
    }
}

// API to get All booking for a User
export const getUserBookings= async(req,res)=>{
    try{
        const user=req.user._id;
        const bookings=await Booking.find({user}).populate("room hotel").sort({createdAt:-1});
        res.json({success:true,bookings});
    }
    catch(error){
        res.json({success:false,message:error.message});
    }
}
 // API to get booking datai of Particular hotel

 export const getHotelBooking=async(req,res)=>{
    try{
    const hotel=await Hotel.findOne({owner:req.auth.userId});
    if(!hotel){
        return res.json({success:false,message:"No Hotel found"});
    }
    const bookings=await Booking.find({hotel:hotel._id}).populate("room hotel user").sort({createdAt : -1});
    //Total Bookings
    const totalBookings=bookings.length;
    // Total revenue
    const totalRevenue=bookings.reduce((acc,booking)=>acc+booking.totalPrice,0)
    res.json({success:true,dashBoardData:{totalBookings,totalRevenue,bookings}});
   }
   catch(error){
    res.json({succes:false,message:"Failed to fetch Bookings"});
   }

 }