# 📋 Complaint Management System

<div align="center">

A full-stack, portfolio-quality **Complaint Management System** — rules-based intelligent priority detection, SLA-based escalation, audit timelines, analytics dashboard, email notifications, and admin user management.

[![Node](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Nodemailer](https://img.shields.io/badge/Nodemailer-30B980?style=for-the-badge&logo=npm&logoColor=white)](https://nodemailer.com/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![Status](https://img.shields.io/badge/status-stable-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-orange?style=flat-square)
![Database](https://img.shields.io/badge/database-JSON-lightgrey?style=flat-square)

</div>

---

## 📸 Screenshots

> Add screenshots here (`assets/screenshots/login.png`, `dashboard.png`, `admin-dashboard.png`) to showcase the UI.

```
assets/screenshots/
├── login.png            # Login with User/Admin tabs
├── user-dashboard.png   # User's complaint dashboard
├── admin-dashboard.png  # Admin analytics dashboard
├── track.png            # Complaint timeline & SLA view
└── profile.png          # User profile / change password
```

---

> 🚫 **Note:** This project is **rule-based**, not AI/ML. The "smart" priority detection uses a simple, easy-to-read keyword/score system — no external ML or AI services are used.

---

## ✨ Features

### 🎯 Smart Priority Detection
- Analyzes complaint **category**, **title**, and **description**
- Suggests one of **Low / Medium / High / Critical** using a simple scoring system
- Live **priority preview** shown to the user before submitting
- Admin can **override** the final priority (suggested vs. final are kept separate)

### ⏱️ SLA-Based Escalation
- Configurable resolution time per priority (kept in one central place)
- Each complaint gets an automatic **SLA deadline**
- Complaints exceeding their deadline are flagged as **Escalated** (automatically, on the backend)
- Escalated badge + overdue detection across the UI; resolved/closed complaints never stay escalated

| Priority | Resolution Time |
|----------|-----------------|
| Critical | 4 hours |
| High     | 12 hours |
| Medium   | 24 hours |
| Low      | 72 hours |

### 📜 Complaint Timeline / Audit History
- **Append-only** history of every important action: created, assigned, priority changed, status changed, escalated, resolved, closed, feedback submitted
- Records previous/new value, performer, comment, and timestamp
- Chronological timeline UI shown to users (own complaints) and admins (full history)

### 📊 Admin Analytics Dashboard
- **Stat cards:** total / pending / in-progress / resolved / escalated
- **Charts:** complaints by category, priority, and department
- **Resolution performance:** avg. resolution time, resolved count, SLA-breached count
- Aggregated on the backend (no heavy frontend computation)

### ⭐ Post-Resolution Feedback
- Users can rate **1–5** stars + optional comment
- Only allowed for **resolved/closed** complaints
- **One** feedback per complaint per user (no spam)
- Admins can view all feedback

### 📧 Email Notifications
- Automated email to the complaint owner on status updates
- **Password reset** emails with a secure, time-limited (30 min) token link
- Works out-of-the-box with a console fallback if no SMTP is configured (perfect for local dev)
- Configurable via `.env` (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)

### 👤 User Profile & Password
- Profile page to view account details and update your display name
- Change your password (current password verified first)
- **Forgot password** flow: reset link sent by email, valid for 30 minutes

### 🔐 Admin User Management
- Admins can list every user with account info and complaint counts
- **Enable / disable** accounts (disabled users cannot log in)
- **Promote** a user to admin
- **Delete** users (their complaints are detached, never deleted)
- Safety guards: you can't disable/delete yourself or remove the **last remaining admin**

### 🕵️ Duplicate Complaint Detection
- On submission, similar complaints already raised by the same user are detected
- Word-overlap based similarity (no external libraries)
- A warning with links to the existing complaints is shown after submitting

### 📅 Filtering & ▶️ CSV Export
- Admin complaint table supports filtering by **status**, **priority**, escalation, and **date range (from / to)**
- **Export CSV** button downloads the current complaint list, plus a backend export endpoint for automation

### 🔐 Roles
- **User:** register, login, submit complaints, track status/timeline, see assigned dept/priority/escalation, give feedback, manage profile & password
- **Admin:** login, manage all complaints, search/filter/export, assign, change status, override priority, manage users, see history/SLA/analytics, view feedback

---

## 🗂️ Project Structure

```
complaint-management-system/
├── backend/
│   └── backend/
│       ├── config/
│       │   └── slaConfig.js          # Centralized SLA hours per priority
│       ├── services/
│       │   ├── priorityService.js    # Rule-based priority detection
│       │   ├── slaService.js         # SLA deadline + escalation logic
│       │   ├── historyService.js     # Append-only history records
│       │   └── emailService.js       # Nodemailer (SMTP) + dev console fallback
│       ├── index.js                  # Express app, routes, auth, middleware
│       ├── package.json
│       └── db.json                   # Flat-file JSON database
├── frontend/
│   ├── *.html                        # Landing, auth, dashboard, profile, admin pages
│   ├── css/style.css                 # Single stylesheet (responsive)
│   └── js/                           # Page-specific logic + helpers
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended, includes `fetch`)

### 1. Install dependencies
```bash
cd backend/backend
npm install
```

### 2. Configure environment
Create a `.env` file in `backend/backend/` (optional — defaults to port 5000):
```
PORT=5000
```

#### Email configuration (optional)
By default, email notifications and password-reset links are **logged to the console** so the app works with zero setup in development. To send real emails, add your SMTP credentials to `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

> 💡 For Gmail, generate an **App Password** (Google Account → Security → App passwords) rather than using your normal login password.

### 3. Run the server
```bash
npm start
```
Or with auto-restart during development:
```bash
npm run dev
```

The server serves both the **REST API** and the **frontend** at:
```
http://localhost:5000
```

---

## 🔑 Default Admin Account

The backend auto-seeds an admin on first run:

| Email             | Password   |
|-------------------|------------|
| admin@college.edu | admin123   |

> ⚠️ Change this in production.

---

## 🧪 Testing

Register a user (or use the default admin) via the UI, submit a complaint, and observe:

- **Priority preview** live-updates as you type
- After submitting, the **track page** shows status, priority, suggested priority, SLA deadline, escalation status, assigned department, and the full timeline
- As **admin**, open **Manage Complaints** to assign, change status, override priority, and filter by escalation
- Once a complaint is **resolved**, the owner can submit **feedback**
- **Profile page** lets you update your name and change your password
- **Manage Users** (admin) lets you enable/disable, promote, or delete users
- Submitting a duplicate complaint warns you and links to the existing one
- **Admin → Manage Complaints** supports status/priority/date-range filters plus a **CSV Export** button
- Status updates trigger an **email notification** to the owner (console in dev mode)
- **Forgot Password** on the login page emails a reset link (30-minute validity)

**API smoke test (PowerShell):**
```powershell
$body = @{ email = "admin@college.edu"; password = "admin123" } | ConvertTo-Json
$admin = Invoke-RestMethod -Uri http://localhost:5000/api/auth/login -Method Post -ContentType "application/json" -Body $body
$h = @{ Authorization = "Bearer $($admin.token)" }
Invoke-RestMethod -Uri http://localhost:5000/api/admin/analytics -Headers $h
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint                 | Auth | Description          |
|--------|--------------------------|------|----------------------|
| POST   | `/api/auth/register`     | No   | Register a user      |
| POST   | `/api/auth/login`        | No   | Login                |
| GET    | `/api/auth/me`           | Yes  | Current user         |
| POST   | `/api/auth/logout`       | Yes  | Invalidate token     |
| POST   | `/api/auth/forgot-password` | No | Send reset email (returns `devResetLink` in dev mode) |
| POST   | `/api/auth/reset-password` | No | Set new password with a valid token |

### Profile
| Method | Endpoint                 | Auth | Description               |
|--------|--------------------------|------|---------------------------|
| GET    | `/api/auth/profile`      | Yes  | View account details      |
| PUT    | `/api/auth/profile`      | Yes  | Update display name       |
| PUT    | `/api/auth/password`     | Yes  | Change password           |

### Complaints
| Method | Endpoint                        | Role   | Description                    |
|--------|---------------------------------|--------|--------------------------------|
| POST   | `/api/complaints`               | User   | Create (auto priority + SLA + duplicate check) |
| GET    | `/api/complaints`               | User   | My complaints                  |
| GET    | `/api/complaints/all`           | Admin  | All complaints (query filters: `status`, `priority`, `escalated`, `from`, `to`) |
| GET    | `/api/complaints/:id`           | Owner/Admin | Single complaint         |
| GET    | `/api/complaints/:id/history`   | Owner/Admin | Timeline/audit history   |

### Admin Management
| Method | Endpoint                              | Role  | Description            |
|--------|---------------------------------------|-------|------------------------|
| PUT    | `/api/admin/complaints/:id/status`    | Admin | Update status (emails owner) |
| PUT    | `/api/admin/complaints/:id/priority`  | Admin | Override priority      |
| PUT    | `/api/admin/complaints/:id/assign`    | Admin | Assign to dept/person  |

### Admin — User Management
| Method | Endpoint                       | Role  | Description              |
|--------|--------------------------------|-------|--------------------------|
| GET    | `/api/admin/users`             | Admin | List users + complaints count |
| PUT    | `/api/admin/users/:id/status`  | Admin | Enable / disable a user  |
| PUT    | `/api/admin/users/:id/role`    | Admin | Promote user to admin    |
| DELETE | `/api/admin/users/:id`         | Admin | Delete a user            |

### Admin — Export
| Method | Endpoint               | Role  | Description                        |
|--------|------------------------|-------|------------------------------------|
| GET    | `/api/admin/export/csv`| Admin | Download all complaints as CSV     |

### Feedback
| Method | Endpoint                    | Role  | Description        |
|--------|-----------------------------|-------|--------------------|
| POST   | `/api/complaints/:id/feedback` | Owner | Rate + comment    |
| GET    | `/api/admin/feedback`        | Admin | View all feedback |

### Analytics
| Method | Endpoint             | Role  | Description               |
|--------|----------------------|-------|---------------------------|
| GET    | `/api/admin/analytics` | Admin | Aggregated dashboard data |

---

## 🛠️ How It Works

**Smart Priority (rule-based, not AI):**
`priorityService.js` starts at score `0`, adds weights for the category, then adds keyword scores (critical keywords weight highest). The total score maps to Low/Medium/High/Critical. To tune it, edit `CATEGORY_WEIGHTS` and `KEYWORD_SCORES` at the top of the file.

**SLA & Escalation:**
`slaConfig.js` holds the resolution hours per priority. On creation, the backend computes `slaDeadline = createdAt + hours`. On every read/admin call, `slaService` checks whether the deadline passed while the complaint is still unresolved and flags it `escalated` (adding an `escalated` history entry automatically).

**History / Timeline:**
`historyService.addHistory()` appends records to `complaint.history`. It only ever appends — never edits or removes — keeping a trustworthy audit trail.

**Email Notifications & Password Reset:**
`emailService.js` wraps Nodemailer with HTTPS-safe transport and a JSON payload. If SMTP is configured in `.env` it sends real email; otherwise it logs to the console (dev mode) and returns a `devResetLink`. Password-reset tokens are 64-char random hex, stored in-memory with a **30-minute expiry**, and are single-use.

**Duplicate Detection:**
`POST /api/complaints` compares the new complaint against the user's existing ones using word-overlap similarity (Jaccard-style). If similarity ≥ 0.7 it is flagged as a duplicate and returned so the UI can warn with links.

**Filters & Export:**
`GET /api/complaints/all` accepts `status`, `priority`, `escalated`, `from`, and `to` query params. `GET /api/admin/export/csv` streams every complaint as a downloadable CSV for reporting.

---

## 🔐 Security Notes
- Passwords hashed with **bcrypt**
- Token-based auth (custom in-memory tokens)
- Role checks on all admin routes
- Users can only access **their own** complaints (backend-enforced)
- Backend validation on all inputs; no raw DB errors exposed
- Secrets excluded via `.gitignore` (`.env`, `node_modules`)

---

## 📌 Statuses
`Pending` → `In Progress` → `Resolved` → `Closed`

## 🗂️ Categories
Electrical · IT/Network · Maintenance · Food/Mess · Security · Sanitation · Other

---

## 🚧 Future Enhancements
Kept intentionally out of scope for now:
- Real-time notifications (WebSocket)
- Staff/Department Officer role
- Advanced SLA automation & reminders
- Predictive analytics
- Multi-tenant support (multiple colleges/institutions)
- Image / attachment uploads for complaints
