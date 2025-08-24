import Booking from "../models/booking.js";
import Room from "../models/room.js";
import Hotel from "../models/hotel.js";
import transporter from "../config/nodeMailer.js";
import { Stripe } from "stripe";
// Utility function to check room availability
const checkAvailability = async ({ checkInDate, checkOutDate, room }) => {
  try {
    const bookings = await Booking.find({
      room,
      checkInDate: { $lte: checkOutDate },
      checkOutDate: { $gte: checkInDate },
    });
    return bookings.length === 0;
  } catch (error) {
    console.error(error.message);
    throw error;
  }
};

// API to check Availability
export const checkAvailabilityAPI = async (req, res) => {
  try {
    const { room, checkInDate, checkOutDate } = req.body;
    const isAvailable = await checkAvailability({ checkInDate, checkOutDate, room });
    res.json({ success: true, isAvailable });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// API to create a new booking
export const createBooking = async (req, res) => {
  try {
    const { room, checkInDate, checkOutDate, guests } = req.body;
    const user = req.user._id;

    // Check room availability
    const isAvailable = await checkAvailability({ checkInDate, checkOutDate, room });
    if (!isAvailable) {
      return res.json({ success: false, message: "Room is Not Available" });
    }

    // Get room data
    const roomData = await Room.findById(room).populate("hotel");

    // Calculate total price
    let totalPrice = roomData.pricePerNight;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const timeDiff = checkOut.getTime() - checkIn.getTime();
    const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    totalPrice *= nights;

    // Create booking
    const booking = await Booking.create({
      user,
      room,
      hotel: roomData.hotel._id,
      guests: Number(guests),
      checkInDate,
      checkOutDate,
      totalPrice,
    });

    // Send confirmation email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: req.user.email,
      subject: "Booking Confirmation",
      html: `
        <h1>Booking Confirmed</h1>
        <p>Dear ${req.user.name},</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p>Your booking for room <b>${roomData.name}</b> 
        at hotel <b>${roomData.hotel.name}</b> 
        is confirmed from ${booking.checkInDate.toDateString()} 
        to ${booking.checkOutDate.toDateString()}.</p>
        <h2>Total Price: ₹ ${booking.totalPrice}</h2>
        <p>We look forward to hosting you!</p>
        <p>Thank you for choosing our service.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Booking Created Successfully", booking });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// API to get All bookings for a User
export const getUserBookings = async (req, res) => {
  try {
    const user = req.user._id;
    const bookings = await Booking.find({ user })
      .populate("room hotel")
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// API to get bookings of a particular hotel (for hotel owners)
export const getHotelBooking = async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ owner: req.user._id });
    if (!hotel) {
      return res.json({ success: false, message: "No Hotel found" });
    }

    const bookings = await Booking.find({ hotel: hotel._id })
      .populate("room hotel user")
      .sort({ createdAt: -1 });

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((acc, booking) => acc + booking.totalPrice, 0);

    res.json({
      success: true,
      dashBoardData: { totalBookings, totalRevenue, bookings },
    });
  } catch (error) {
    res.json({ success: false, message: "Failed to fetch Bookings" });
  }
};
export const stripePayment = async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId).populate("room");
    const roomData= await Room.findById(booking.room._id).populate("hotel");
    const totalPrice = booking.totalPrice;
    const {origin} = req.headers;
    const line_items = [
      {
        price_data: {
          currency: "inr",
          product_data: {
            name: roomData.name,
            
          },
          unit_amount: totalPrice * 100,
        },
        quantity: 1,
      },
    ];
    const session = await stripe.checkout.sessions.create({
      
      line_items,
      mode: "payment",
      success_url: `${origin}/bookings/me`,
      cancel_url: `${origin}/bookings/me`,
      metadata: {
        bookingId: booking._id.toString(),
      },
    });
 

    res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    res.json({ success: false, message: "Payment Failed" });
  }
};
