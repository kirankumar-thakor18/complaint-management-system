// ===== SLA SERVICE =====
//
// Helpers for computing SLA deadlines, overdue status and escalation.
// All times are handled as ISO strings and millisecond timestamps so that
// comparisons are reliable regardless of timezone.

const { SLA_HOURS } = require("../config/slaConfig");

const MS_PER_HOUR = 60 * 60 * 1000;

// Resolved/Closed complaints are never considered active escalations.
const INACTIVE_STATUSES = ["Resolved", "Closed"];

/**
 * Compute the SLA deadline for a priority, starting from a createdAt ISO string.
 * @param {string} priority
 * @param {string} createdAtIso - ISO timestamp string
 * @returns {string} ISO deadline string
 */
function computeSlaDeadline(priority, createdAtIso) {
  const hours = SLA_HOURS[priority] !== undefined ? SLA_HOURS[priority] : SLA_HOURS.Low;
  const createdMs = new Date(createdAtIso).getTime();
  return new Date(createdMs + hours * MS_PER_HOUR).toISOString();
}

/**
 * Whether a complaint's SLA has been breached (deadline passed and not resolved).
 * @param {object} complaint
 * @param {string} nowIso - current time as ISO string (defaults to now)
 * @returns {boolean}
 */
function isOverdue(complaint, nowIso) {
  if (INACTIVE_STATUSES.includes(complaint.status)) return false;
  if (!complaint.slaDeadline) return false;
  const now = new Date(nowIso || new Date()).getTime();
  return new Date(complaint.slaDeadline).getTime() < now;
}

/**
 * Milliseconds overdue for an overdue complaint (0 if not overdue).
 */
function overdueMs(complaint, nowIso) {
  if (!isOverdue(complaint, nowIso)) return 0;
  const now = new Date(nowIso || new Date()).getTime();
  return now - new Date(complaint.slaDeadline).getTime();
}

/**
 * Human-readable overdue duration like "3h 12m".
 */
function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/**
 * Markes a complaint as escalated if it is currently overdue and not already escalated.
 * Returns true if it was (re)flagged, false otherwise.
 */
function refreshEscalation(complaint, nowIso) {
  if (!isOverdue(complaint, nowIso)) {
    complaint.escalated = false;
    return false;
  }
  const newlyEscalated = !complaint.escalated;
  complaint.escalated = true;
  return newlyEscalated;
}

module.exports = {
  SLA_HOURS,
  computeSlaDeadline,
  isOverdue,
  overdueMs,
  formatDuration,
  refreshEscalation,
  INACTIVE_STATUSES,
};
