import nodemailer from "nodemailer";

// Create a test account or replace with real credentials.
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
   
  auth: {
    user: process.env.SMPT_USER ,
    pass: process.env.SMPT_PASS ,
  },
});
export default transporter;