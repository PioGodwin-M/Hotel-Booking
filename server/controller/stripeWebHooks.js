import stripe from "stripe";
import Booking from "../models/booking.js";
export const stripeWebHooks= async(req,res)=>{
    const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature']
    let event;
    try{
        event = stripeInstance.webhooks.constructEvent(req.body,sig,process.env.STRIPE_WEBHOOK_SECRET)  
    }catch(err){
        return res.status(400).send(`Webhook Error:${err.message}`);
    }
    if(event.type==='payment_intent.succeeded'){
        const paymentIntent=event.data.object;
        const paymentId=paymentIntent.id;
        const session=await stripeInstance.checkout.sessions.list({
            payment_intent:paymentId,
            
        });
        const {bookingId}=session.data[0].metadata;
        await Booking.findByIdAndUpdate(bookingId,{isPaid:true,paymentMethod:'Stripe'});

    }
}