// ===== SEED =====
// Creates the default admin account on first run.

const bcrypt = require("bcryptjs");
const { withDB } = require("./db");
const { nextId } = require("./utils/helpers");

async function seedAdmin() {
  await withDB(async (db) => {
    if (!db.feedback) db.feedback = [];
    if (!db.resetTokens) db.resetTokens = [];
    if (db.users.some((u) => u.role === "admin")) return;

    db.users.push({
      id: nextId(db.users),
      name: "Admin",
      email: "admin@college.edu",
      password: await bcrypt.hash("admin123", 10),
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    console.log("Default admin created: admin@college.edu / admin123");
  });
}

module.exports = { seedAdmin };
