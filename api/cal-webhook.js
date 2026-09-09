// api/cal-webhook.js
export default async function handler(req, res) {
  const booking = req.body;

  // Your static UPI payment link
  const upiLink = "upi://pay?pa=your-vpa@upi&pn=YourName&am=500&cu=INR&tn=Consultation";

  // Respond with the link (could also send via email/SMS)
  res.json({ url: upiLink });
}
