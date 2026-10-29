// FoodShare frontend. The browser talks only to the Node.js API, never directly to Supabase.
const API_BASE = window.FOODSHARE_API_URL || "http://localhost:3000/api";
const grid = document.getElementById("donationGrid");
const form = document.getElementById("donationForm");
const formMessage = document.getElementById("formMessage");
const listMessage = document.getElementById("listMessage");
let donations = [];

const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const prettyDate = value => {
  if (!value) return "Not specified";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Not specified" : d.toLocaleString([], {dateStyle:"medium", timeStyle:"short"});
};
function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload;
}
function renderDonations() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const filtered = donations.filter(d => {
    const haystack = `${d.food_name} ${d.donor_name} ${d.location} ${d.category}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!category || d.category === category);
  });
  document.getElementById("statAvailable").textContent = donations.filter(d => d.status === "available").length;
  document.getElementById("statMeals").textContent = donations.reduce((sum, d) => sum + (d.status === "available" ? (Number(d.portions) || 0) : 0), 0);
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">${donations.length ? "No donations match your search." : "No donations listed yet. Be the first to share food!"}</div>`;
    return;
  }
  grid.innerHTML = filtered.map(d => `
    <article class="donation-card">
      <div class="card-top"><span class="category-pill">${escapeHTML(d.category)}</span><span class="status-pill">${d.status === "available" ? "Available" : "Claimed"}</span></div>
      <h3>${escapeHTML(d.food_name)}</h3><div class="donor">Shared by ${escapeHTML(d.donor_name)}</div>
      <div class="details">
        <span>📦 ${escapeHTML(d.quantity)}</span><span>📍 ${escapeHTML(d.location)}</span>
        <span>⏰ Until ${escapeHTML(prettyDate(d.available_until))}</span>
        ${d.notes ? `<span>ℹ️ ${escapeHTML(d.notes)}</span>` : ""}
      </div>
      <div class="card-bottom"><small>${d.status === "available" ? "Please coordinate pickup safely." : "This listing has been claimed."}</small>
      <button class="claim-btn" data-id="${escapeHTML(d.id)}" ${d.status !== "available" ? "disabled" : ""}>${d.status === "available" ? "Request food" : "Claimed"}</button></div>
    </article>`).join("");
  grid.querySelectorAll(".claim-btn:not(:disabled)").forEach(btn => btn.addEventListener("click", () => claimDonation(btn.dataset.id, btn)));
}
async function loadDonations() {
  grid.innerHTML = `<div class="empty-state">Loading donations…</div>`;
  showMessage(listMessage, "");
  try {
    const result = await api("/donations");
    donations = result.donations || [];
    renderDonations();
  } catch (error) {
    grid.innerHTML = `<div class="empty-state">Unable to load donations. Make sure the backend is running and configured.</div>`;
    showMessage(listMessage, error.message, true);
  }
}
async function claimDonation(id, button) {
  const recipient = window.prompt("Enter your organization or recipient name to request this donation:");
  if (!recipient || !recipient.trim()) return;
  const contact = window.prompt("Enter a contact email or phone number for pickup coordination:");
  if (!contact || !contact.trim()) return;
  button.disabled = true;
  try {
    await api(`/donations/${encodeURIComponent(id)}/claim`, {
      method: "POST", body: JSON.stringify({ recipient_name: recipient.trim(), recipient_contact: contact.trim() })
    });
    showMessage(listMessage, "Request recorded. Please coordinate pickup with the donor.");
    await loadDonations();
  } catch (error) {
    showMessage(listMessage, error.message, true);
    button.disabled = false;
  }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(formMessage, "Publishing donation…");
  const data = Object.fromEntries(new FormData(form).entries());
  data.available_until = new Date(data.available_until).toISOString();
  try {
    await api("/donations", { method: "POST", body: JSON.stringify(data) });
    form.reset();
    showMessage(formMessage, "Thank you! Your donation is now listed.");
    await loadDonations();
    document.getElementById("available").scrollIntoView({behavior:"smooth"});
  } catch (error) {
    showMessage(formMessage, error.message, true);
  }
});
document.getElementById("searchInput").addEventListener("input", renderDonations);
document.getElementById("categoryFilter").addEventListener("change", renderDonations);
document.getElementById("refreshBtn").addEventListener("click", loadDonations);
loadDonations();
