// Unit tests for SLA deadline computation and escalation.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const slaService = require("../services/slaService");

test("computeSlaDeadline adds the priority's SLA hours", () => {
  const created = "2026-01-01T00:00:00.000Z";
  assert.equal(slaService.computeSlaDeadline("Critical", created), "2026-01-01T04:00:00.000Z");
  assert.equal(slaService.computeSlaDeadline("High", created), "2026-01-01T12:00:00.000Z");
  assert.equal(slaService.computeSlaDeadline("Medium", created), "2026-01-02T00:00:00.000Z");
  assert.equal(slaService.computeSlaDeadline("Low", created), "2026-01-04T00:00:00.000Z");
});

test("unknown priorities fall back to the Low window", () => {
  const created = "2026-01-01T00:00:00.000Z";
  assert.equal(slaService.computeSlaDeadline("Whatever", created), slaService.computeSlaDeadline("Low", created));
});

test("isOverdue is true only for past deadlines on active complaints", () => {
  const overdue = { status: "Pending", slaDeadline: "2026-01-01T00:00:00.000Z" };
  const future = { status: "Pending", slaDeadline: "2099-01-01T00:00:00.000Z" };
  const resolved = { status: "Resolved", slaDeadline: "2026-01-01T00:00:00.000Z" };

  assert.equal(slaService.isOverdue(overdue, "2026-01-02T00:00:00.000Z"), true);
  assert.equal(slaService.isOverdue(future, "2026-01-02T00:00:00.000Z"), false);
  assert.equal(slaService.isOverdue(resolved, "2026-01-02T00:00:00.000Z"), false);
});

test("refreshEscalation flags once, then idempotently", () => {
  const complaint = { status: "Pending", slaDeadline: "2026-01-01T00:00:00.000Z", escalated: false };
  const now = "2026-01-02T00:00:00.000Z";

  assert.equal(slaService.refreshEscalation(complaint, now), true); // newly flagged
  assert.equal(complaint.escalated, true);
  assert.equal(slaService.refreshEscalation(complaint, now), false); // already flagged
});

test("refreshEscalation clears the flag once the complaint is no longer overdue", () => {
  const complaint = { status: "Resolved", slaDeadline: "2026-01-01T00:00:00.000Z", escalated: true };
  const now = "2026-01-02T00:00:00.000Z";

  assert.equal(slaService.refreshEscalation(complaint, now), false);
  assert.equal(complaint.escalated, false);
});

test("formatDuration renders hours and minutes", () => {
  assert.equal(slaService.formatDuration(12 * 60000), "12m");
  assert.equal(slaService.formatDuration(3 * 3600000 + 12 * 60000), "3h 12m");
});
