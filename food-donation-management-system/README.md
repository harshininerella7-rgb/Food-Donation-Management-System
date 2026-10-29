# FoodShare — Food Donation Management System

A full-stack starter project with HTML/CSS/JavaScript frontend, Node.js + Express backend, and Supabase PostgreSQL database.

## Features
- List surplus food donations with donor, category, quantity, pickup location, notes, and deadline.
- Browse, search, and filter donations.
- Request/claim a donation; the database function atomically prevents double-claims.
- Responsive design for desktop and mobile.
- Backend input validation and a health endpoint.

## Project structure
```text
food-donation-management-system/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── supabase/
│   └── schema.sql
└── README.md
```

## Setup

### 1. Create Supabase project
1. Create a project at https://supabase.com.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. In **Project Settings → API**, copy the Project URL and **service_role** key.
4. Keep the service-role key private. Never paste it into frontend files or publish it.

### 2. Configure backend
Install Node.js 18 or newer. In a terminal:
```bash
cd backend
npm install
```
Copy `.env.example` to `.env` and fill in the actual values:
```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
PORT=3000
FRONTEND_ORIGIN=*
```
Start the API:
```bash
npm start
```
Check `http://localhost:3000/api/health`. It should return `{"status":"ok","configured":true}`.

### 3. Start frontend
Serve the `frontend` directory using a local static server. For example, with VS Code install the **Live Server** extension and choose **Open with Live Server** on `frontend/index.html`. Keep the backend running on port 3000.

If your backend uses a different URL, edit the `API_BASE` value at the top of `frontend/app.js`. For deployment, set a specific `FRONTEND_ORIGIN` and use HTTPS.

## Important notes before real-world deployment
- This is a student/demo project, not a production-ready food-safety or identity-verification platform.
- Add authentication and role-based authorization before allowing public users to create or claim listings.
- Add rate limiting, logging, abuse protection, email verification, and a privacy policy.
- The current claim flow records the recipient's contact and marks the donation claimed; it does not automatically email the donor. The donor email is returned only to the backend and is not displayed publicly.
- Configure database backups, retention rules, and proper monitoring before production use.
- Do not list food that is unsafe or past its safe storage period; follow local food-safety rules.

## API routes
- `GET /api/health` — health/configuration check.
- `GET /api/donations` — list donations (`?status=available` or `?limit=50` optional).
- `POST /api/donations` — create a donation.
- `POST /api/donations/:id/claim` — request a donation.

## Sample donation request
```json
{
  "donor_name": "Green Leaf Cafe",
  "contact_email": "donations@example.com",
  "food_name": "Vegetable rice boxes",
  "category": "Cooked Meals",
  "quantity": "20 meal boxes",
  "location": "Madhapur, Hyderabad",
  "available_until": "2027-01-01T12:00:00.000Z",
  "notes": "Prepared today; keep refrigerated"
}
```
