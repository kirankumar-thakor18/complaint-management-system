// ===== SERVER ENTRY POINT =====
// Starts the API + static frontend. See app.js for the app itself.

require("dotenv").config();
const { createApp } = require("./app");
const { seedAdmin } = require("./seed");

const PORT = process.env.PORT || 5000;

seedAdmin()
  .then(() => {
    createApp().listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
