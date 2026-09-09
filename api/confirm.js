/**
 * api/confirm.js — Vercel Serverless Function
 * Receives the booking + payment proof and marks it confirmed.
 *
 * MODES:
 *  A) DEMO (default): auto-approves instantly — good for testing the UI.
 *  B) MANUAL: store booking as "pending" and confirm it yourself.
 *  C) SUPABASE: persist for real — uncomment the block below.
 */

const DEMO_AUTO_APPROVE = true;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const b = req.body || {};
  const required = ["name", "email", "phone", "duration", "date", "time", "amount"];
  const missing = required.filter((k) => !b[k]);
  if (missing.length) {
    return res.status(400).json({ error: "Missing fields: " + missing.join(", ") });
  }
  if (!b.txnId && !b.screenshot) {
    return res.status(400).json({ error: "Payment proof required (txnId or screenshot)" });
  }

  const booking = {
    id: "BK-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    name: b.name,
    company: b.company || null,
    email: b.email,
    phone: b.phone,
    duration: +b.duration,
    date: b.date,
    time: b.time,
    amount: +b.amount,
    txnId: b.txnId || null,
    status: DEMO_AUTO_APPROVE ? "confirmed" : "pending_verification",
    createdAt: new Date().toISOString()
  };

  /* ---- SUPABASE (uncomment + set env vars) ---------------------------
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { error } = await supabase.from("bookings").insert({
    ...booking,
    screenshot_data_url: b.screenshot || null   // better: upload to Storage first
  });
  if (error) return res.status(500).json({ error: error.message });
  -------------------------------------------------------------------- */

  console.log("New booking:", booking.id, booking.status);

  return res.status(200).json({
    status: booking.status,
    bookingRef: booking.id,
    message: DEMO_AUTO_APPROVE
      ? "Payment verified (demo). Booking confirmed."
      : "Payment received. We'll verify and confirm within a few hours."
  });
};
