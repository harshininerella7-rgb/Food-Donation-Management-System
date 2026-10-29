require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(cors({ origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN.split(",").map(s => s.trim()) }));
app.use(express.json({ limit: "32kb" }));

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

app.get("/api/health", (_req, res) => res.json({ status: "ok", configured: Boolean(supabase) }));
app.use("/api", (req, res, next) => {
  if (!supabase) return res.status(503).json({ error: "Backend is not configured. Add Supabase credentials to backend/.env." });
  next();
});

const clean = value => typeof value === "string" ? value.trim() : "";
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const categories = ["Cooked Meals", "Fruits & Vegetables", "Bakery", "Packaged Food", "Dairy", "Other"];

app.get("/api/donations", async (req, res) => {
  try {
    const { status = "all", limit = "100" } = req.query;
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 200);
    let query = supabase.from("donations").select("id,donor_name,contact_email,food_name,category,quantity,portions,location,available_until,notes,status,created_at").order("created_at", { ascending: false }).limit(safeLimit);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ donations: data || [] });
  } catch (err) {
    console.error("GET donations:", err.message);
    res.status(500).json({ error: "Could not fetch donations." });
  }
});

app.post("/api/donations", async (req, res) => {
  const body = req.body || {};
  const donor_name = clean(body.donor_name);
  const contact_email = clean(body.contact_email).toLowerCase();
  const food_name = clean(body.food_name);
  const category = clean(body.category);
  const quantity = clean(body.quantity);
  const location = clean(body.location);
  const notes = clean(body.notes);
  const available_until = new Date(body.available_until);
  const portions = Number.parseInt(body.portions, 10);
  if (!donor_name || !food_name || !quantity || !location || !contact_email || !category || !body.available_until) {
    return res.status(400).json({ error: "Please complete all required fields." });
  }
  if (!validEmail(contact_email)) return res.status(400).json({ error: "Enter a valid contact email." });
  if (!categories.includes(category)) return res.status(400).json({ error: "Choose a valid food category." });
  if ([donor_name, food_name, quantity, location, notes].some(s => s.length > 500)) return res.status(400).json({ error: "One or more fields are too long." });
  if (Number.isNaN(available_until.getTime()) || available_until <= new Date()) return res.status(400).json({ error: "Pickup deadline must be in the future." });
  try {
    const record = { donor_name, contact_email, food_name, category, quantity, location, notes: notes || null, available_until: available_until.toISOString(), portions: Number.isInteger(portions) && portions > 0 ? portions : 1, status: "available" };
    const { data, error } = await supabase.from("donations").insert(record).select("id,food_name,status,created_at").single();
    if (error) throw error;
    res.status(201).json({ donation: data });
  } catch (err) {
    console.error("POST donation:", err.message);
    res.status(500).json({ error: "Could not create donation. Check that schema.sql has been run." });
  }
});

app.post("/api/donations/:id/claim", async (req, res) => {
  const recipient_name = clean(req.body?.recipient_name);
  const recipient_contact = clean(req.body?.recipient_contact);
  if (!recipient_name || !recipient_contact) return res.status(400).json({ error: "Recipient name and contact are required." });
  if (recipient_name.length > 120 || recipient_contact.length > 254) return res.status(400).json({ error: "Recipient details are too long." });
  try {
    const { data: donation, error: fetchError } = await supabase.from("donations").select("id,status,available_until").eq("id", req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!donation) return res.status(404).json({ error: "Donation not found." });
    if (donation.status !== "available") return res.status(409).json({ error: "This donation has already been claimed." });
    if (new Date(donation.available_until) <= new Date()) return res.status(409).json({ error: "The pickup deadline has passed." });
    // A database function performs an atomic status transition to prevent two successful claims.
    const { data, error } = await supabase.rpc("claim_donation", {
      p_donation_id: req.params.id,
      p_recipient_name: recipient_name,
      p_recipient_contact: recipient_contact
    });
    if (error) throw error;
    if (!data || data.success !== true) return res.status(409).json({ error: data?.message || "This donation is no longer available." });
    res.status(201).json({ claim: { donation_id: req.params.id, status: "claimed" } });
  } catch (err) {
    console.error("POST claim:", err.message);
    res.status(500).json({ error: "Could not record claim. Ensure schema.sql has been run." });
  }
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Unexpected server error." });
});
app.listen(PORT, () => console.log(`FoodShare API listening at http://localhost:${PORT}`));
