// Unit tests for the rule-based priority suggestion service.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { suggestPriority, PRIORITIES } = require("../services/priorityService");

test("exposes the four priority levels", () => {
  assert.deepEqual(PRIORITIES, ["Low", "Medium", "High", "Critical"]);
});

test("critical keywords plus a heavy category map to Critical", () => {
  const result = suggestPriority("Fire in the laboratory", "Electrical", "There is an emergency, smoke everywhere");
  assert.equal(result, "Critical");
});

test("no matching keywords with a neutral category maps to Low", () => {
  const result = suggestPriority("Light bulb flickering", "Other", "The bulb flickers sometimes at night");
  assert.equal(result, "Low");
});

test("category weight plus a medium keyword group maps to Medium", () => {
  const result = suggestPriority("Water pipe issue", "Maintenance", "Regular maintenance needed for the pipe");
  assert.equal(result, "Medium");
});

test("handles empty/missing inputs without throwing", () => {
  assert.equal(suggestPriority("", "", ""), "Low");
  assert.equal(suggestPriority(undefined, undefined, undefined), "Low");
});
