require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { suggestPriority, PRIORITIES } = require("./services/priorityService");
const slaService = require("./services/slaService");
const { addHistory } = require("./services/historyService");

const app = express();
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "../../frontend")));

// ===== DATA HELPERS =====
const DB_PATH = path.join(__dirname, "db.json");

function readDB() {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(arr) {
  return arr.length > 0 ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}

// ===== AUTH MIDDLEWARE =====
const tokens = {}; // token -> userId

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  const userId = tokens[token];
  if (!userId) {
    return res.status(401).json({ error: "Invalid token" });
  }
  req.userId = userId;
  next();
}

// Look up the authenticated user; ensures the user still exists. Sets req.user.
function loadUser(req, res, next) {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }
  req.user = user;
  req.db = db;
  next();
}

// Ensures the current user is an admin.
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ===== COMPLAINT HELPERS =====
const STATUSES = ["Pending", "In Progress", "Resolved", "Closed"];

function findComplaint(db, id) {
  return db.complaints.find((c) => c.id === parseInt(id));
}

// A short hand for the "performed by" object used in history entries.
function performedBy(user) {
  return { id: user.id, name: user.name, role: user.role };
}

// Migrate legacy history entries (status/timestamp/note shape) so older
// complaints still render on the new timeline.
function normalizeHistory(complaint) {
  if (!Array.isArray(complaint.history) || complaint.history.length === 0) {
    complaint.history = [];
  }
  complaint.history = complaint.history.map((h) => {
    if (h && h.action) return h;
    return {
      action: h && h.status ? "status_changed" : "created",
      previousValue: null,
      newValue: h && h.status ? h.status : "Pending",
      performedBy: null,
      comment: h && h.note ? h.note : "Legacy entry.",
      timestamp: h && h.timestamp ? toIso(h.timestamp) : complaint.createdAt || new Date().toISOString(),
    };
  });
}

// Convert a localized date string ("2 Sept 2026, 9:41 pm") to ISO if possible.
function toIso(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Apply SLA + escalation refresh to a single complaint. Returns true if it
// was newly escalated (so we can add a history entry). Also back-fills missing
// SLA/suggested fields on legacy complaints so older data still behaves correctly.
function refreshComplaintSla(complaint, db, nowIso) {
  // Back-fill suggested priority for legacy complaints.
  if (!complaint.suggestedPriority) {
    complaint.suggestedPriority = complaint.priority || "Low";
  }
  // Back-fill SLA deadline for legacy complaints.
  if (!complaint.slaDeadline && complaint.createdAt) {
    complaint.slaDeadline = slaService.computeSlaDeadline(complaint.suggestedPriority, complaint.createdAt);
  }
  const newlyEscalated = slaService.refreshEscalation(complaint, nowIso);
  if (newlyEscalated) {
    addHistory(complaint, {
      action: "escalated",
      newValue: "true",
      performedBy: { id: null, name: "System", role: "system" },
      comment: "SLA deadline exceeded — complaint escalated automatically.",
    });
  }
  return newlyEscalated;
}

// ===== AUTH ROUTES =====

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (name.trim().length < 3) {
      return res.status(400).json({ error: "Name must be at least 3 characters" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const db = readDB();
    const existingUser = db.users.find((u) => u.email === email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: nextId(db.users),
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "user",
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    writeDB(db);

    const token = crypto.randomBytes(32).toString("hex");
    tokens[token] = newUser.id;

    res.status(201).json({
      message: "Registration successful",
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const db = readDB();
    const user = db.users.find((u) => u.email === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    tokens[token] = user.id;

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me - get current user
app.get("/api/auth/me", authMiddleware, loadUser, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role });
});

// POST /api/auth/logout
app.post("/api/auth/logout", authMiddleware, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(" ")[1];
  delete tokens[token];
  res.json({ message: "Logged out" });
});

// ===== COMPLAINT ROUTES =====

// POST /api/complaints - create complaint
app.post("/api/complaints", authMiddleware, loadUser, (req, res) => {
  try {
    const { title, category, description } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({ error: "Title, category, and description are required" });
    }
    if (title.trim().length < 5) {
      return res.status(400).json({ error: "Title must be at least 5 characters" });
    }
    if (description.trim().length < 15) {
      return res.status(400).json({ error: "Description must be at least 15 characters" });
    }
    if (typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ error: "Please select a valid category" });
    }

    const db = req.db;
    const now = new Date();
    const suggestedPriority = suggestPriority(title, category, description);
    const slaDeadline = slaService.computeSlaDeadline(suggestedPriority, now.toISOString());

    const newComplaint = {
      id: nextId(db.complaints),
      title: title.trim(),
      category,
      description: description.trim(),
      suggestedPriority,
      priority: suggestedPriority, // final priority starts equal to suggested
      status: "Pending",
      userId: req.userId,
      assignedTo: null,
      slaDeadline,
      escalated: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      resolvedAt: null,
      history: [],
    };

    addHistory(newComplaint, {
      action: "created",
      newValue: "Pending",
      performedBy: performedBy(req.user),
      comment: "Complaint submitted.",
    });

    db.complaints.push(newComplaint);
    writeDB(db);

    res.status(201).json({
      message: "Complaint created",
      complaint: newComplaint,
      suggestedPriority,
    });
  } catch (err) {
    console.error("Create complaint error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/complaints - get user's complaints (admin gets all via /all)
app.get("/api/complaints", authMiddleware, loadUser, (req, res) => {
  try {
    const db = req.db;
    const complaints = db.complaints.filter((c) => c.userId === req.userId);
    const nowIso = new Date().toISOString();
    complaints.forEach((c) => refreshComplaintSla(c, db, nowIso));
    writeDB(db);
    res.json({ complaints });
  } catch (err) {
    console.error("Get complaints error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/complaints/all - admin gets all complaints
app.get("/api/complaints/all", authMiddleware, loadUser, adminMiddleware, (req, res) => {
  try {
    const db = req.db;
    const nowIso = new Date().toISOString();
    db.complaints.forEach((c) => refreshComplaintSla(c, db, nowIso));
    writeDB(db);
    res.json({ complaints: db.complaints });
  } catch (err) {
    console.error("Get all complaints error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/complaints/:id - get single complaint (ownership enforced)
app.get("/api/complaints/:id", authMiddleware, loadUser, (req, res) => {
  try {
    const db = req.db;
    const complaint = findComplaint(db, req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    // Users can only view their own complaints; admins can view all.
    if (req.user.role !== "admin" && complaint.userId !== req.userId) {
      return res.status(403).json({ error: "You can only view your own complaints" });
    }

    refreshComplaintSla(complaint, db, new Date().toISOString());
    normalizeHistory(complaint);
    writeDB(db);

    res.json({ complaint });
  } catch (err) {
    console.error("Get complaint error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/complaints/:id/history - complaint timeline/history
app.get("/api/complaints/:id/history", authMiddleware, loadUser, (req, res) => {
  try {
    const db = req.db;
    const complaint = findComplaint(db, req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    if (req.user.role !== "admin" && complaint.userId !== req.userId) {
      return res.status(403).json({ error: "You can only view your own complaints" });
    }
    normalizeHistory(complaint);
    res.json({ history: complaint.history });
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== ADMIN COMPLAINT MANAGEMENT =====

// PUT /api/admin/complaints/:id/status - admin updates status
app.put("/api/admin/complaints/:id/status", authMiddleware, loadUser, adminMiddleware, (req, res) => {
  try {
    const db = req.db;
    const complaint = findComplaint(db, req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const { status, comment } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${STATUSES.join(", ")}` });
    }

    // Prevent closed complaints from being reopened to itself; allow any transition otherwise.
    const oldStatus = complaint.status;
    if (oldStatus === status) {
      return res.status(400).json({ error: "Complaint is already in that status" });
    }

    complaint.status = status;
    complaint.updatedAt = new Date().toISOString();

    if (status === "Resolved") {
      complaint.resolvedAt = complaint.resolvedAt || new Date().toISOString();
    }
    if (status === "Closed") {
      complaint.escalated = false;
    }

    addHistory(complaint, {
      action: "status_changed",
      previousValue: oldStatus,
      newValue: status,
      performedBy: performedBy(req.user),
      comment: comment || null,
    });

    if (status === "Resolved" || status === "Closed") {
      addHistory(complaint, {
        action: status === "Resolved" ? "resolved" : "closed",
        newValue: status,
        performedBy: performedBy(req.user),
        comment: comment || "Complaint " + (status === "Resolved" ? "resolved." : "closed."),
      });
    }

    writeDB(db);
    res.json({ message: "Status updated", complaint });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/complaints/:id/priority - admin overrides priority
app.put("/api/admin/complaints/:id/priority", authMiddleware, loadUser, adminMiddleware, (req, res) => {
  try {
    const db = req.db;
    const complaint = findComplaint(db, req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const { priority, comment } = req.body;
    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${PRIORITIES.join(", ")}` });
    }

    const oldPriority = complaint.priority;
    complaint.priority = priority;
    complaint.updatedAt = new Date().toISOString();

    // Recompute SLA deadline based on the final priority, but keep resolution time
    // anchored to the original creation time so it isn't abused by changing priority later.
    complaint.slaDeadline = slaService.computeSlaDeadline(priority, complaint.createdAt);

    addHistory(complaint, {
      action: "priority_changed",
      previousValue: oldPriority,
      newValue: priority,
      performedBy: performedBy(req.user),
      comment: comment ? `${comment} (Suggested was ${complaint.suggestedPriority})` : `Priority overridden. Suggested was ${complaint.suggestedPriority}.`,
    });

    writeDB(db);
    res.json({ message: "Priority updated", complaint });
  } catch (err) {
    console.error("Update priority error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/complaints/:id/assign - admin assigns complaint
app.put("/api/admin/complaints/:id/assign", authMiddleware, loadUser, adminMiddleware, (req, res) => {
  try {
    const db = req.db;
    const complaint = findComplaint(db, req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const { assignee, comment } = req.body;
    if (!assignee || !assignee.trim()) {
      return res.status(400).json({ error: "Assignee is required" });
    }

    const oldAssignee = complaint.assignedTo;
    complaint.assignedTo = assignee.trim();
    complaint.updatedAt = new Date().toISOString();

    addHistory(complaint, {
      action: "assigned",
      previousValue: oldAssignee,
      newValue: complaint.assignedTo,
      performedBy: performedBy(req.user),
      comment: comment || null,
    });

    writeDB(db);
    res.json({ message: "Complaint assigned", complaint });
  } catch (err) {
    console.error("Assign complaint error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== FEEDBACK ROUTES =====

// POST /api/complaints/:id/feedback - user submits feedback for resolved/closed complaint
app.post("/api/complaints/:id/feedback", authMiddleware, loadUser, (req, res) => {
  try {
    const db = req.db;
    const complaint = findComplaint(db, req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    if (complaint.userId !== req.userId) {
      return res.status(403).json({ error: "You can only give feedback on your own complaints" });
    }
    if (!["Resolved", "Closed"].includes(complaint.status)) {
      return res.status(400).json({ error: "Feedback can only be submitted for resolved or closed complaints" });
    }

    const rating = parseInt(req.body.rating, 10);
    const comment = (req.body.comment || "").trim();
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be a number between 1 and 5" });
    }
    if (comment.length > 500) {
      return res.status(400).json({ error: "Comment must be 500 characters or fewer" });
    }

    // One feedback per complaint per user.
    const existing = (db.feedback || []).find((f) => f.complaintId === complaint.id && f.userId === req.userId);
    if (existing) {
      return res.status(409).json({ error: "You have already submitted feedback for this complaint" });
    }

    const feedback = {
      id: nextId(db.feedback || []),
      complaintId: complaint.id,
      userId: req.userId,
      rating,
      comment: comment || null,
      createdAt: new Date().toISOString(),
    };

    if (!db.feedback) db.feedback = [];
    db.feedback.push(feedback);

    addHistory(complaint, {
      action: "feedback_submitted",
      newValue: `${rating}/5`,
      performedBy: performedBy(req.user),
      comment: comment || null,
    });

    writeDB(db);
    res.status(201).json({ message: "Feedback submitted", feedback });
  } catch (err) {
    console.error("Submit feedback error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/feedback - admin views all feedback
app.get("/api/admin/feedback", authMiddleware, loadUser, adminMiddleware, (req, res) => {
  try {
    const db = req.db;
    res.json({ feedback: db.feedback || [] });
  } catch (err) {
    console.error("Get feedback error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== ADMIN ANALYTICS =====

// GET /api/admin/analytics - aggregated dashboard statistics
app.get("/api/admin/analytics", authMiddleware, loadUser, adminMiddleware, (req, res) => {
  try {
    const db = req.db;
    const nowIso = new Date().toISOString();

    // Refresh escalation flags before computing stats.
    db.complaints.forEach((c) => refreshComplaintSla(c, db, nowIso));

    const complaints = db.complaints;

    // --- Complaint statistics ---
    const total = complaints.length;
    const pending = complaints.filter((c) => c.status === "Pending").length;
    const inProgress = complaints.filter((c) => c.status === "In Progress").length;
    const resolved = complaints.filter((c) => c.status === "Resolved").length;
    const closed = complaints.filter((c) => c.status === "Closed").length;
    const escalated = complaints.filter((c) => c.escalated).length;

    // --- Category analytics ---
    const categoryCounts = {};
    complaints.forEach((c) => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });

    // --- Priority analytics (by final priority) ---
    const priorityCounts = {};
    PRIORITIES.forEach((p) => (priorityCounts[p] = 0));
    complaints.forEach((c) => {
      priorityCounts[c.priority] = (priorityCounts[c.priority] || 0) + 1;
    });

    // --- Department/assignee analytics ---
    const departmentCounts = {};
    complaints.forEach((c) => {
      const key = c.assignedTo || "Unassigned";
      departmentCounts[key] = (departmentCounts[key] || 0) + 1;
    });

    // --- Resolution performance ---
    const resolvedOrClosed = complaints.filter((c) => ["Resolved", "Closed"].includes(c.status));
    let totalResolutionMs = 0;
    let resolvedCount = 0;
    resolvedOrClosed.forEach((c) => {
      const start = new Date(c.createdAt).getTime();
      const end = (c.resolvedAt ? new Date(c.resolvedAt) : new Date(c.updatedAt)).getTime();
      totalResolutionMs += end - start;
      resolvedCount++;
    });
    const avgResolutionMs = resolvedCount > 0 ? totalResolutionMs / resolvedCount : null;

    const slaBreachedCount = complaints.filter((c) => c.escalated).length;

    res.json({
      stats: { total, pending, inProgress, resolved, closed, escalated },
      categories: categoryCounts,
      priorities: priorityCounts,
      departments: departmentCounts,
      performance: {
        resolvedCount,
        slaBreachedCount,
        avgResolutionHours: avgResolutionMs === null ? null : Math.round((avgResolutionMs / 3600000) * 10) / 10,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== SEED ADMIN USER =====
async function seedAdmin() {
  const db = readDB();
  if (!db.feedback) db.feedback = [];
  const adminExists = db.users.find((u) => u.role === "admin");
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    db.users.push({
      id: 1,
      name: "Admin",
      email: "admin@college.edu",
      password: hashedPassword,
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    writeDB(db);
    console.log("Default admin created: admin@college.edu / admin123");
  }
}

// ===== START SERVER =====
seedAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
