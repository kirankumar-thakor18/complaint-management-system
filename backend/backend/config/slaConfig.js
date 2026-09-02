// ===== SLA CONFIGURATION (Centralized) =====
//
// Resolution time (in hours) per priority. These values are used by
// slaService to compute deadline and escalation. Keep them in one place —
// do not duplicate these numbers elsewhere.

const SLA_HOURS = {
  Critical: 4,
  High: 12,
  Medium: 24,
  Low: 72,
};

module.exports = { SLA_HOURS };
