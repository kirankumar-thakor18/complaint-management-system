// ===== ADMIN ROUTES =====
// Mounted at /api/admin

const router = require("express").Router();

const { handle } = require("../utils/handler");
const { PRIORITIES } = require("../services/priorityService");
const slaService = require("../services/slaService");
const { addHistory } = require("../services/historyService");
const emailService = require("../services/emailService");
const { STATUSES } = require("../config/constants");
const {
  findComplaint,
  performedBy,
  refreshComplaintSla,
  escapeHtmlText,
  escapeCsv,
} = require("../utils/helpers");

const adminOnly = { admin: true };

// PUT /api/admin/complaints/:id/status - admin updates status
router.put(
  "/complaints/:id/status",
  handle((req, res) => {
    const db = req.db;
    const complaint = findComplaint(db, req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const { status, comment } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${STATUSES.join(", ")}` });
    }

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

    // Notify the complaint owner about the status change (fire-and-forget).
    const owner = db.users.find((u) => u.id === complaint.userId);
    if (owner && owner.role !== "admin") {
      const body = emailService.wrap(`
        <p>Hi <strong>${escapeHtmlText(owner.name)}</strong>,</p>
        <p>Your complaint <strong>"${escapeHtmlText(complaint.title)}"</strong> has been updated.</p>
        <p><strong>Status:</strong> <span style="color:#2563eb;font-weight:600;">${status}</span> <span style="color:#9ca3af;">(${oldStatus} → ${status})</span></p>
        ${comment ? `<p><strong>Admin note:</strong> ${escapeHtmlText(comment)}</p>` : ""}
        <p style="text-align:center;margin:24px 0;">
          <a href="${emailService.APP_URL}/track-complaint.html?id=${complaint.id}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Complaint</a>
        </p>
      `);
      emailService.sendEmail(owner.email, `Complaint #${complaint.id} is now ${status}`, body);
    }

    res.json({ message: "Status updated", complaint });
  }, adminOnly)
);

// PUT /api/admin/complaints/:id/priority - admin overrides priority
router.put(
  "/complaints/:id/priority",
  handle((req, res) => {
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

    // Recompute SLA deadline based on the final priority, but keep resolution
    // time anchored to the original creation time so it isn't abused by
    // changing priority later.
    complaint.slaDeadline = slaService.computeSlaDeadline(priority, complaint.createdAt);

    addHistory(complaint, {
      action: "priority_changed",
      previousValue: oldPriority,
      newValue: priority,
      performedBy: performedBy(req.user),
      comment: comment ? `${comment} (Suggested was ${complaint.suggestedPriority})` : `Priority overridden. Suggested was ${complaint.suggestedPriority}.`,
    });

    res.json({ message: "Priority updated", complaint });
  }, adminOnly)
);

// PUT /api/admin/complaints/:id/assign - admin assigns complaint
router.put(
  "/complaints/:id/assign",
  handle((req, res) => {
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

    res.json({ message: "Complaint assigned", complaint });
  }, adminOnly)
);

// GET /api/admin/feedback - admin views all feedback
router.get(
  "/feedback",
  handle(
    (req, res) => {
      res.json({ feedback: req.db.feedback || [] });
    },
    { ...adminOnly, readOnly: true }
  )
);

// GET /api/admin/analytics - aggregated dashboard statistics
router.get(
  "/analytics",
  handle((req, res) => {
    const db = req.db;
    const nowIso = new Date().toISOString();

    // Refresh escalation flags before computing stats.
    db.complaints.forEach((c) => refreshComplaintSla(c, nowIso));

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
    resolvedOrClosed.forEach((c) => {
      const start = new Date(c.createdAt).getTime();
      const end = (c.resolvedAt ? new Date(c.resolvedAt) : new Date(c.updatedAt)).getTime();
      totalResolutionMs += end - start;
    });
    const resolvedCount = resolvedOrClosed.length;
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
  }, adminOnly)
);

// GET /api/admin/users - list all users (without password hashes)
router.get(
  "/users",
  handle(
    (req, res) => {
      const db = req.db;
      const users = db.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        disabled: Boolean(u.disabled),
        createdAt: u.createdAt,
        complaintCount: db.complaints.filter((c) => c.userId === u.id).length,
      }));
      res.json({ users });
    },
    { ...adminOnly, readOnly: true }
  )
);

// PUT /api/admin/users/:id/status - enable or disable a user account
router.put(
  "/users/:id/status",
  handle((req, res) => {
    const db = req.db;
    const id = parseInt(req.params.id, 10);
    const user = db.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { disabled } = req.body;
    if (id === req.userId && disabled === true) {
      return res.status(400).json({ error: "You cannot disable your own account" });
    }
    user.disabled = disabled ? true : false;
    res.json({ message: "User status updated", user: { id: user.id, name: user.name, disabled: user.disabled } });
  }, adminOnly)
);

// PUT /api/admin/users/:id/role - promote/demote user role
router.put(
  "/users/:id/role",
  handle((req, res) => {
    const db = req.db;
    const id = parseInt(req.params.id, 10);
    const user = db.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { role } = req.body;
    if (role !== "admin" && role !== "user") {
      return res.status(400).json({ error: "Role must be 'admin' or 'user'" });
    }
    if (id === req.userId && role !== "admin") {
      return res.status(400).json({ error: "You cannot demote your own admin account" });
    }
    // Prevent removing the last admin.
    if (user.role === "admin" && role !== "admin") {
      const adminCount = db.users.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot remove the last admin account" });
      }
    }
    user.role = role;
    res.json({ message: "User role updated", user: { id: user.id, name: user.name, role: user.role } });
  }, adminOnly)
);

// DELETE /api/admin/users/:id - delete a user account
router.delete(
  "/users/:id",
  handle((req, res) => {
    const db = req.db;
    const id = parseInt(req.params.id, 10);
    const user = db.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (id === req.userId) return res.status(400).json({ error: "You cannot delete your own account" });
    if (user.role === "admin") {
      const adminCount = db.users.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) return res.status(400).json({ error: "Cannot delete the last admin account" });
    }

    // Detach the user's complaints so they don't become orphaned.
    db.complaints.forEach((c) => {
      if (c.userId === id) c.userId = null;
    });
    db.users = db.users.filter((u) => u.id !== id);
    res.json({ message: "User deleted" });
  }, adminOnly)
);

// GET /api/admin/export/csv - download all complaints as CSV
router.get(
  "/export/csv",
  handle((req, res) => {
    const db = req.db;
    const nowIso = new Date().toISOString();
    db.complaints.forEach((c) => refreshComplaintSla(c, nowIso));

    const headers = ["ID", "Title", "Category", "Priority", "Status", "Escalated", "User", "Assigned To", "SLA Deadline", "Created At", "Resolved At"];
    const rows = db.complaints.map((c) => {
      const owner = c.userId ? db.users.find((u) => u.id === c.userId) : null;
      return [
        c.id,
        c.title,
        c.category,
        c.priority,
        c.status,
        c.escalated ? "Yes" : "No",
        owner ? owner.name : "Deleted User",
        c.assignedTo || "Unassigned",
        c.slaDeadline ? new Date(c.slaDeadline).toLocaleString() : "",
        new Date(c.createdAt).toLocaleString(),
        c.resolvedAt ? new Date(c.resolvedAt).toLocaleString() : "",
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="complaints.csv"');
    res.send(csv);
  }, adminOnly)
);

module.exports = router;
