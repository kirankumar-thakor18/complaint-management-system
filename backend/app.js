// ===== EXPRESS APP FACTORY =====
//
// createApp() builds the Express app without listening, so tests can mount
// it on an ephemeral port. index.js is the production entry point.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve frontend files (same origin, so the frontend needs no hard-coded host).
  app.use(express.static(path.join(__dirname, "../frontend")));

  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/complaints", require("./routes/complaints"));
  app.use("/api/admin", require("./routes/admin"));

  return app;
}

module.exports = { createApp };
