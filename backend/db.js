// ===== JSON FILE DATABASE =====
//
// Reads/writes db.json with three guarantees:
//   1. Writes are atomic (temp file + rename) so a crash mid-write can never
//      leave a half-written/corrupted db.json behind.
//   2. ALL file access (reads included) is serialized through one queue, so
//      concurrent requests cannot overwrite each other's changes (lost
//      updates) or read a half-replaced file.
//   3. The final rename retries on transient Windows errors (EPERM/EBUSY)
//      caused by antivirus or another process briefly holding the file.
//
// Use withDB(mutator) for anything that changes data — it gives you an
// exclusive snapshot, then persists it before resolving. Use withRead(fn)
// for reads that must see a consistent snapshot. readDB() is the raw reader
// (tests, tooling).

const fs = require("fs/promises");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "db.json");

const EMPTY_DB = { users: [], complaints: [], feedback: [], resetTokens: [] };

const RENAME_RETRIES = 5;
const RENAME_RETRY_DELAY_MS = 20;

let queue = Promise.resolve();

async function readDB() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const data = JSON.parse(raw);
    return { ...EMPTY_DB, ...data };
  } catch (err) {
    if (err.code === "ENOENT") return structuredClone(EMPTY_DB);
    throw err;
  }
}

async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const transient = err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES";
      if (!transient || attempt >= RENAME_RETRIES - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_DELAY_MS * (attempt + 1)));
    }
  }
}

async function writeAtomic(data) {
  const tmpPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await renameWithRetry(tmpPath, DB_PATH);
}

// Serializes work on the queue. Every queued job sees the file only after
// the previous job's writes are complete.
function enqueue(job) {
  const run = queue.then(job);
  // Keep the chain alive even if this job failed.
  queue = run.then(() => {}, () => {});
  return run;
}

// Runs mutator(db) exclusively, then persists the (possibly mutated) db
// atomically before resolving.
function withDB(mutator) {
  return enqueue(async () => {
    const db = await readDB();
    const result = await mutator(db);
    await writeAtomic(db);
    return result;
  });
}

// Runs reader(db) against a consistent snapshot without writing. Serialized
// with withDB so a read can never race a rename.
function withRead(reader) {
  return enqueue(async () => reader(await readDB()));
}

module.exports = { readDB, withDB, withRead, DB_PATH };
