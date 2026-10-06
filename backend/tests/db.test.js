// Tests for the atomic, serialized JSON file store.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");

// Must be set before ../db is required — db.js resolves the path on load.
process.env.DB_PATH = path.join(os.tmpdir(), `cms-db-test-${process.pid}-${Date.now()}.json`);

const { withDB, readDB } = require("../db");

test("withDB persists mutations atomically", async () => {
  await withDB(async (db) => {
    db.users.push({ id: 1, name: "Test" });
  });

  const db = await readDB();
  assert.equal(db.users.length, 1);
  assert.equal(db.users[0].name, "Test");
  assert.ok(!fs.existsSync(process.env.DB_PATH + ".tmp"), "temp file should not be left behind");
});

test("concurrent read-modify-write cycles do not lose updates", async () => {
  const N = 25;
  await Promise.all(
    Array.from({ length: N }, (_, i) =>
      withDB(async (db) => {
        db.counter = (db.counter || 0) + 1;
        db.complaints.push({ id: i });
      })
    )
  );

  const db = await readDB();
  assert.equal(db.counter, N, "every increment must survive");
  assert.equal(db.complaints.length, N);
});

test("a failing mutator does not corrupt the store or stall the queue", async () => {
  await assert.rejects(
    withDB(async () => {
      throw new Error("boom");
    }),
    /boom/
  );

  await withDB(async (db) => {
    db.ok = true;
  });

  const db = await readDB();
  assert.equal(db.ok, true, "queue must keep working after a failed transaction");
});

test("readDB returns default collections for a missing file", async () => {
  const previous = process.env.DB_PATH;
  process.env.DB_PATH = path.join(os.tmpdir(), `cms-db-missing-${Date.now()}.json`);
  delete require.cache[require.resolve("../db")];
  const fresh = require("../db");

  const db = await fresh.readDB();
  assert.deepEqual(db.users, []);
  assert.deepEqual(db.complaints, []);
  assert.deepEqual(db.feedback, []);

  process.env.DB_PATH = previous;
  delete require.cache[require.resolve("../db")];
  require("../db");
});
