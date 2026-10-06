// Central API configuration — load this BEFORE any script that talks to the
// backend. The frontend is served by Express from the same origin, so no
// host or port ever needs to be hard-coded in individual files.
const API_URL = window.location.origin.startsWith("http")
  ? `${window.location.origin}/api`
  : "http://localhost:5000/api"; // fallback when a page is opened via file://
