// End-to-end API tests: real Express app on an ephemeral port, isolated
// temp-file database, full auth + complaint lifecycle.

const os = require("os");
const path = require("path");
const fs = require("fs");

// Must be set before the app modules are required.
process.env.DB_PATH = path.join(os.tmpdir(), `cms-api-test-${process.pid}-${Date.now()}.json`);
process.env.JWT_SECRET = "test-secret";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../app");
const { seedAdmin } = require("../seed");

let server = null;
let base = "";

async function startServer() {
  const s = createApp().listen(0);
  await new Promise((resolve) => s.once("listening", resolve));
  server = s;
  base = `http://127.0.0.1:${s.address().port}/api`;
}

async function api(method, pathname, { token, body, query } = {}) {
  const url = `${base}${pathname}${query ? `?${new URLSearchParams(query)}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

before(async () => {
  await seedAdmin();
  await startServer();
});

after(() => {
  if (server && server.listening) server.close();
  fs.rmSync(process.env.DB_PATH, { force: true });
});

let userToken;
let adminToken;
let complaintId;

test("rejects unauthenticated requests", async () => {
  const res = await api("GET", "/auth/me");
  assert.equal(res.status, 401);
});

test("registers a new user and the JWT works immediately", async () => {
  const res = await api("POST", "/auth/register", {
    body: { name: "Test User", email: "user@test.com", password: "secret123" },
  });
  assert.equal(res.status, 201);
  assert.ok(res.data.token, "registration must return a token");
  assert.equal(res.data.user.role, "user");
  userToken = res.data.token;

  const me = await api("GET", "/auth/me", { token: userToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.email, "user@test.com");
});

test("rejects duplicate registration and weak input", async () => {
  const dup = await api("POST", "/auth/register", {
    body: { name: "Test User", email: "user@test.com", password: "secret123" },
  });
  assert.equal(dup.status, 409);

  const weak = await api("POST", "/auth/register", {
    body: { name: "X", email: "not-an-email", password: "1" },
  });
  assert.equal(weak.status, 400);
});

test("logs in the seeded admin", async () => {
  const res = await api("POST", "/auth/login", {
    body: { email: "admin@college.edu", password: "admin123" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.user.role, "admin");
  adminToken = res.data.token;
});

test("rejects bad credentials", async () => {
  const res = await api("POST", "/auth/login", {
    body: { email: "admin@college.edu", password: "wrong" },
  });
  assert.equal(res.status, 401);
});

test("blocks non-admins from admin routes", async () => {
  const res = await api("GET", "/admin/users", { token: userToken });
  assert.equal(res.status, 403);
});

test("creates a complaint with priority, SLA deadline and history", async () => {
  const res = await api("POST", "/complaints", {
    token: userToken,
    body: {
      title: "Water leak in hostel bathroom",
      category: "Maintenance",
      description: "Water is leaking continuously from the pipe near the sink.",
    },
  });
  assert.equal(res.status, 201);
  assert.ok(res.data.complaint.slaDeadline, "SLA deadline must be computed");
  assert.ok(res.data.complaint.history.length === 1);
  assert.equal(res.data.complaint.history[0].action, "created");
  complaintId = res.data.complaint.id;
});

test("validates complaint input", async () => {
  const res = await api("POST", "/complaints", {
    token: userToken,
    body: { title: "hi", category: "", description: "too short" },
  });
  assert.equal(res.status, 400);
});

test("lists the owner's complaints", async () => {
  const res = await api("GET", "/complaints", { token: userToken });
  assert.equal(res.status, 200);
  assert.ok(res.data.complaints.some((c) => c.id === complaintId));
});

test("prevents viewing someone else's complaint", async () => {
  const other = await api("POST", "/auth/register", {
    body: { name: "Other User", email: "other@test.com", password: "secret123" },
  });
  const res = await api("GET", `/complaints/${complaintId}`, { token: other.data.token });
  assert.equal(res.status, 403);
});

test("admin updates status, which the owner can see in history", async () => {
  const put = await api("PUT", `/admin/complaints/${complaintId}/status`, {
    token: adminToken,
    body: { status: "In Progress", comment: "Looking into it" },
  });
  assert.equal(put.status, 200);
  assert.equal(put.data.complaint.status, "In Progress");

  const history = await api("GET", `/complaints/${complaintId}/history`, { token: userToken });
  assert.equal(history.status, 200);
  const actions = history.data.history.map((h) => h.action);
  assert.ok(actions.includes("status_changed"));
});

test("rejects invalid status transitions", async () => {
  const same = await api("PUT", `/admin/complaints/${complaintId}/status`, {
    token: adminToken,
    body: { status: "In Progress" },
  });
  assert.equal(same.status, 400);

  const invalid = await api("PUT", `/admin/complaints/${complaintId}/status`, {
    token: adminToken,
    body: { status: "Bogus" },
  });
  assert.equal(invalid.status, 400);
});

test("feedback requires a resolved/closed complaint and allows only one", async () => {
  const early = await api("POST", `/complaints/${complaintId}/feedback`, {
    token: userToken,
    body: { rating: 5 },
  });
  assert.equal(early.status, 400);

  await api("PUT", `/admin/complaints/${complaintId}/status`, {
    token: adminToken,
    body: { status: "Resolved" },
  });

  const ok = await api("POST", `/complaints/${complaintId}/feedback`, {
    token: userToken,
    body: { rating: 4, comment: "Fixed quickly" },
  });
  assert.equal(ok.status, 201);

  const again = await api("POST", `/complaints/${complaintId}/feedback`, {
    token: userToken,
    body: { rating: 1 },
  });
  assert.equal(again.status, 409);
});

test("admin analytics aggregates the data", async () => {
  const res = await api("GET", "/admin/analytics", { token: adminToken });
  assert.equal(res.status, 200);
  assert.equal(res.data.stats.total, res.data.stats.resolved + res.data.stats.inProgress + res.data.stats.pending + res.data.stats.closed);
  assert.ok(res.data.stats.total >= 1);
});

test("concurrent complaint creation loses no writes", async () => {
  const N = 10;
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      api("POST", "/complaints", {
        token: userToken,
        body: {
          title: `Concurrent issue number ${i} reported`,
          category: "Other",
          description: `Distinct description for concurrent complaint number ${i}.`,
        },
      })
    )
  );
  assert.ok(results.every((r) => r.status === 201), "all parallel creates must succeed");

  const list = await api("GET", "/complaints", { token: userToken });
  const concurrent = list.data.complaints.filter((c) => c.title.startsWith("Concurrent issue"));
  assert.equal(concurrent.length, N, "no parallel create may be lost");
});

test("CSV export returns a downloadable report", async () => {
  const res = await fetch(`${base}/admin/export/csv`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  const csv = await res.text();
  assert.match(csv, /Title/);
});

test("JWT survives a server restart (stateless auth)", async () => {
  server.close();
  await startServer();

  const me = await api("GET", "/auth/me", { token: userToken });
  assert.equal(me.status, 200, "old token must still be valid after restart");
  assert.equal(me.data.email, "user@test.com");
});
