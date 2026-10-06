// ===== SHARED HELPERS =====
//
// Small pure-ish helpers used across route modules.

const slaService = require("../services/slaService");
const { addHistory } = require("../services/historyService");

function nextId(arr) {
  return arr.length > 0 ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}

function findComplaint(db, id) {
  return db.complaints.find((c) => c.id === parseInt(id));
}

// A short hand for the "performed by" object used in history entries.
function performedBy(user) {
  return { id: user.id, name: user.name, role: user.role };
}

// The user shape returned to clients (never includes the password hash).
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// Convert a localized date string ("2 Sept 2026, 9:41 pm") to ISO if possible.
function toIso(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
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

// Apply SLA + escalation refresh to a single complaint. Returns true if it
// was newly escalated (so we can add a history entry). Also back-fills missing
// SLA/suggested fields on legacy complaints so older data still behaves correctly.
function refreshComplaintSla(complaint, nowIso) {
  if (!complaint.suggestedPriority) {
    complaint.suggestedPriority = complaint.priority || "Low";
  }
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

// Simple HTML escaping helper for email templates.
function escapeHtmlText(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function escapeCsv(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = {
  nextId,
  findComplaint,
  performedBy,
  publicUser,
  toIso,
  normalizeHistory,
  refreshComplaintSla,
  escapeHtmlText,
  escapeCsv,
};
