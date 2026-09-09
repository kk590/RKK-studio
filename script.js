/* =========================================================
   Booking wizard — cal.com style
   Steps: duration -> date/time -> details -> UPI -> confirmed
   ========================================================= */

const CONFIG = {
  vpa: "yourname@upi",          // <-- your UPI ID
  payeeName: "Aditi Consulting",// <-- payee name
  currency: "INR",
  prices: { 15: 499, 30: 999 }, // duration (min) -> amount
  startHour: 9,                 // slots from 09:00
  endHour: 17,                  // slots until 17:00
  apiEndpoint: "/api/confirm",  // Vercel serverless function
  demoAutoApprove: true         // confirm.js approves instantly in demo mode
};

const state = { duration: null, date: null, time: null, details: null };
const $ = (s) => document.querySelector(s);
const fmtINR = (n) => "₹" + n.toLocaleString("en-IN");

/* ---------- Step navigation ---------- */
function goTo(step) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $("#panel-" + step).classList.add("active");
  document.querySelectorAll("#stepIndicator li").forEach(li => {
    const s = +li.dataset.step;
    li.classList.toggle("active", s === step);
    li.classList.toggle("done", s < step);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-goto]").forEach(b =>
  b.addEventListener("click", () => goTo(+b.dataset.goto)));

/* ---------- Step 1 : duration ---------- */
$("#price-15").textContent = fmtINR(CONFIG.prices[15]) + " / 15 min";
$("#price-30").textContent = fmtINR(CONFIG.prices[30]) + " / 30 min";
document.querySelectorAll(".duration-card").forEach(card => {
  card.addEventListener("click", () => {
    state.duration = +card.dataset.duration;
    renderSlots(); // refresh slot list for new duration
    goTo(2);
  });
});

/* ---------- Step 2 : calendar + slots ---------- */
const calendar = new FullCalendar.Calendar($("#calendar"), {
  initialView: "dayGridMonth",
  height: "auto",
  headerToolbar: { left: "prev,next", center: "title", right: "" },
  selectable: true,
  selectAllow: (sel) => sel.start >= new Date().setHours(0,0,0,0),
  dateClick: (info) => selectDate(info.dateStr)
});
calendar.render();

// grey out past days
document.querySelectorAll(".fc-daygrid-day").forEach(el => {
  const d = new Date(el.dataset.date + "T00:00:00");
  if (d < new Date().setHours(0,0,0,0)) el.classList.add("fc-day-past");
});

function selectDate(dateStr) {
  state.date = dateStr;
  state.time = null;
  const d = new Date(dateStr + "T00:00:00");
  $("#slotsTitle").textContent = d.toLocaleDateString("en-IN",
    { weekday: "long", day: "numeric", month: "long" });
  renderSlots();
}

function renderSlots() {
  const box = $("#slots");
  if (!state.date) return;
  const dur = state.duration || 30;
  const today = new Date().toISOString().slice(0, 10) === state.date;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  let html = "";
  for (let m = CONFIG.startHour * 60; m + dur <= CONFIG.endHour * 60; m += dur) {
    const past = today && m <= nowMin;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    html += `<button class="slot" data-time="${hh}:${mm}" ${past ? "disabled" : ""}
      style="${past ? "opacity:.35;cursor:not-allowed" : ""}">${hh}:${mm}</button>`;
  }
  box.innerHTML = html || '<p class="muted">No slots left this day.</p>';
  box.querySelectorAll(".slot:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => {
      box.querySelectorAll(".slot").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.time = btn.dataset.time;
      setTimeout(() => goTo(3), 250);
    });
  });
}

/* ---------- Step 3 : details form ---------- */
$("#detailsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const d = Object.fromEntries(fd.entries());
  if (!d.name.trim() || !d.email.trim() || !d.phone.trim()) {
    $("#formError").textContent = "Please fill in name, email and phone.";
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    $("#formError").textContent = "That email doesn't look right.";
    return;
  }
  $("#formError").textContent = "";
  state.details = d;
  $("#summaryChip").textContent =
    `${state.duration} min · ${state.date} · ${state.time}`;
  setupPayment();
  goTo(4);
});

/* ---------- Step 4 : UPI payment ---------- */
function setupPayment() {
  const amount = CONFIG.prices[state.duration];
  const note = `Consult ${state.duration}m ${state.date} ${state.time}`
    .replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 60);
  const upi =
    `upi://pay?pa=${encodeURIComponent(CONFIG.vpa)}` +
    `&pn=${encodeURIComponent(CONFIG.payeeName)}` +
    `&am=${amount}&cu=${CONFIG.currency}&tn=${encodeURIComponent(note)}`;

  $("#payAmount").textContent = fmtINR(amount);
  $("#upiLink").href = upi;
  $("#upiString").textContent = upi;

  // QR for desktop users
  const qrBox = $("#qr");
  qrBox.innerHTML = "";
  try {
    new QRCode(qrBox, { text: upi, width: 180, height: 180 });
  } catch { qrBox.innerHTML = '<p class="muted small">QR unavailable — use the button on mobile.</p>'; }
}

$("#payForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const txnId = fd.get("txnId")?.trim();
  const file = fd.get("screenshot");

  if (!txnId && !(file && file.size)) {
    $("#payError").textContent = "Add a transaction ID or a screenshot so we can verify you.";
    return;
  }
  $("#payError").textContent = "";
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Verifying…";

  let screenshotData = null;
  if (file && file.size) screenshotData = await toBase64(file);

  const payload = {
    ...state.details,
    duration: state.duration,
    date: state.date,
    time: state.time,
    amount: CONFIG.prices[state.duration],
    txnId: txnId || null,
    screenshot: screenshotData       // data URL (small demo); use Supabase Storage in prod
  };

  try {
    const res = await fetch(CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Verification failed");

    // local backup of the booking
    const bookings = JSON.parse(localStorage.getItem("bookings") || "[]");
    bookings.push({ ...payload, status: data.status, ref: data.bookingRef, at: Date.now() });
    localStorage.setItem("bookings", JSON.stringify(bookings));

    $("#confirmMsg").textContent =
      `Reference ${data.bookingRef} · We'll email the meeting link to ${state.details.email} shortly.`;
    $("#finalSummary").textContent =
      `${state.duration} min · ${state.date} at ${state.time} · ${fmtINR(payload.amount)} · ${data.status}`;
    goTo(5);
  } catch (err) {
    $("#payError").textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "I've paid — verify & confirm";
  }
});

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ---------- Reset ---------- */
$("#bookAgain").addEventListener("click", () => location.reload());
