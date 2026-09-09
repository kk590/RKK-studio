// api/cal-webhook.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  const booking = req.body;

  const upiLink = "upi://pay?pa=your-vpa@upi&pn=YourName&am=500&cu=INR&tn=Consultation";

  // Send email with UPI link
  const transporter = nodemailer.createTransport({ /* SMTP config */ });
  await transporter.sendMail({
    from: "you@example.com",
    to: booking.email,
    subject: "Complete your booking payment",
    text: `Please pay using this UPI link: ${upiLink}`
  });

  res.json({ status: "UPI link sent to user" });
}
