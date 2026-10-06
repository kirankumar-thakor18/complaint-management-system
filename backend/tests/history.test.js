// Unit tests for the append-only complaint history service.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { addHistory, HISTORY_EVENTS } = require("../services/historyService");

test("addHistory appends entries with defaults filled in", () => {
  const complaint = { history: [] };

  addHistory(complaint, { action: "created", newValue: "Pending" });
  addHistory(complaint, { action: "status_changed", previousValue: "Pending", newValue: "In Progress" });

  assert.equal(complaint.history.length, 2);
  const [first, second] = complaint.history;
  assert.equal(first.action, "created");
  assert.equal(first.previousValue, null);
  assert.equal(first.performedBy, null);
  assert.equal(first.comment, null);
  assert.ok(!isNaN(new Date(first.timestamp).getTime()));
  assert.equal(second.previousValue, "Pending");
  assert.equal(second.newValue, "In Progress");
});

test("addHistory copies the performer so later mutations don't leak in", () => {
  const complaint = { history: [] };
  const performer = { id: 1, name: "Admin", role: "admin" };

  addHistory(complaint, { action: "assigned", performedBy: performer });
  performer.name = "Changed later";

  assert.equal(complaint.history[0].performedBy.name, "Admin");
});

test("declares the expected event types", () => {
  for (const action of ["created", "escalated", "resolved", "feedback_submitted"]) {
    assert.ok(HISTORY_EVENTS.includes(action), `${action} should be a known event`);
  }
});
