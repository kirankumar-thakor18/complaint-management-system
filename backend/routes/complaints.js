// ===== COMPLAINT ROUTES =====
// Mounted at /api/complaints

const router = require("express").Router();

const { handle } = require("../utils/handler");
const { suggestPriority, PRIORITIES } = require("../services/priorityService");
const slaService = require("../services/slaService");
const { addHistory } = require("../services/historyService");
const { STATUSES } = require("../config/constants");
const {
  nextId,
  findComplaint,
  performedBy,
  normalizeHistory,
  refreshComplaintSla,
} = require("../utils/helpers");

// POST /api/complaints - create complaint
router.post(
  "/",
  handle((req, res) => {
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

    // Duplicate detection: find similar complaints already submitted by this user.
    const combined = `${title.trim()} ${description.trim()}`.toLowerCase();
    const duplicates = db.complaints
      .filter((c) => c.userId === req.userId)
      .map((c) => ({ c, hay: `${c.title} ${c.description}`.toLowerCase() }))
      .filter(({ hay }) => {
        if (combined === hay) return true;
        const words = combined.split(/\s+/).filter((w) => w.length > 3);
        let overlap = 0;
        words.forEach((w) => {
          if (hay.includes(w)) overlap++;
        });
        const ratio = words.length ? overlap / words.length : 0;
        return ratio >= 0.7;
      })
      .map(({ c }) => ({ id: c.id, title: c.title, status: c.status, createdAt: c.createdAt }));

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

    res.status(201).json({
      message: "Complaint created",
      complaint: newComplaint,
      suggestedPriority,
      duplicates,
    });
  })
);

// GET /api/complaints - get user's complaints (admin gets all via /all)
router.get(
  "/",
  handle((req, res) => {
    const db = req.db;
    const complaints = db.complaints.filter((c) => c.userId === req.userId);
    const nowIso = new Date().toISOString();
    complaints.forEach((c) => refreshComplaintSla(c, nowIso));
    res.json({ complaints });
  })
);

// GET /api/complaints/all - admin gets all complaints (supports filters)
router.get(
  "/all",
  handle((req, res) => {
    const db = req.db;
    const nowIso = new Date().toISOString();
    db.complaints.forEach((c) => refreshComplaintSla(c, nowIso));

    let result = db.complaints;
    const filters = {};

    if (req.query.status && STATUSES.includes(req.query.status)) {
      result = result.filter((c) => c.status === req.query.status);
      filters.status = req.query.status;
    }
    if (req.query.priority && PRIORITIES.includes(req.query.priority)) {
      result = result.filter((c) => c.priority === req.query.priority);
      filters.priority = req.query.priority;
    }
    if (req.query.from) {
      const from = new Date(req.query.from).getTime();
      if (!isNaN(from)) {
        result = result.filter((c) => new Date(c.createdAt).getTime() >= from);
        filters.from = req.query.from;
      }
    }
    if (req.query.to) {
      const to = new Date(req.query.to).getTime() + 24 * 60 * 60 * 1000; // inclusive of that day
      if (!isNaN(to)) {
        result = result.filter((c) => new Date(c.createdAt).getTime() <= to);
        filters.to = req.query.to;
      }
    }

    res.json({ complaints: result, filters, total: db.complaints.length });
  }, { admin: true })
);

// GET /api/complaints/:id - get single complaint (ownership enforced)
router.get(
  "/:id",
  handle((req, res) => {
    const db = req.db;
    const complaint = findComplaint(db, req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    // Users can only view their own complaints; admins can view all.
    if (req.user.role !== "admin" && complaint.userId !== req.userId) {
      return res.status(403).json({ error: "You can only view your own complaints" });
    }

    refreshComplaintSla(complaint, new Date().toISOString());
    normalizeHistory(complaint);

    res.json({ complaint });
  })
);

// GET /api/complaints/:id/history - complaint timeline/history
router.get(
  "/:id/history",
  handle(
    (req, res) => {
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
    },
    { readOnly: true }
  )
);

// POST /api/complaints/:id/feedback - user submits feedback for resolved/closed complaint
router.post(
  "/:id/feedback",
  handle((req, res) => {
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

    res.status(201).json({ message: "Feedback submitted", feedback });
  })
);

module.exports = router;
