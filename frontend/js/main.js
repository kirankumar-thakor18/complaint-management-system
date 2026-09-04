console.log("Complaint Management System - Frontend Loaded ✅");

// Show the Admin button on the landing page ONLY to a logged-in admin.
const adminLink = document.getElementById("adminLink");
if (adminLink) {
  let user = null;
  try {
    const raw = localStorage.getItem("user");
    user = raw ? JSON.parse(raw) : null;
  } catch (e) {
    user = null;
  }
  const token = localStorage.getItem("token");
  if (!token || !user || user.role !== "admin") {
    adminLink.style.display = "none";
  }
}