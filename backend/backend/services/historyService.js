// ===== COMPLAINT HISTORY SERVICE =====
//
// Append-only timeline/audit log. Every important action on a complaint
// creates a history record. Records are never modified or removed by users.

// Allowed actions (kept in one place for reference).
const HISTORY_EVENTS = [
  "created",
  "priority_changed",
  "assigned",
  "status_changed",
  "escalated",
  "resolved",
  "closed",
  "feedback_submitted",
];

/**
 * Append a new history entry to a complaint. Automatically sets performedBy
 * and timestamp. Uses a copy of the old array so it is append-only.
 *
 * @param {object} complaint - the complaint object to append to
 * @param {object} entry
 * @param {string} entry.action - one of HISTORY_EVENTS
 * @param {string} [entry.previousValue]
 * @param {string} [entry.newValue]
 * @param {object} [entry.performedBy] - { id, name, role }
 * @param {string} [entry.comment]
 */
function addHistory(complaint, { action, previousValue, newValue, performedBy, comment }) {
  const history = Array.isArray(complaint.history) ? complaint.history : [];
  history.push({
    action,
    previousValue: previousValue ?? null,
    newValue: newValue ?? null,
    performedBy: performedBy
      ? { id: performedBy.id, name: performedBy.name, role: performedBy.role }
      : null,
    comment: comment || null,
    timestamp: new Date().toISOString(),
  });
  complaint.history = history;
}

module.exports = { addHistory, HISTORY_EVENTS };
