const API_URL = "http://localhost:5000/api";

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

function getUser() {
  try { return JSON.parse(localStorage.getItem("user")); } catch (e) { return null; }
}

function requireAuth() {
  const token = localStorage.getItem("token");
  if (!token) { window.location.href = "login.html"; return false; }
  return true;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const nameInput = document.getElementById("profileName");
const emailInput = document.getElementById("profileEmail");
const roleInput = document.getElementById("profileRole");
const createdInput = document.getElementById("profileCreated");
const nameError = document.getElementById("nameError");

async function loadProfile() {
  if (!requireAuth()) return;
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_URL}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Failed to load profile", "error"); return; }
    nameInput.value = data.name;
    emailInput.value = data.email;
    roleInput.value = data.role === "admin" ? "Administrator" : "User";
    createdInput.value = formatDate(data.createdAt);
    document.getElementById("userName").textContent = data.name;

    // Redirect admins back to their dashboard context via profile link.
    if (data.role === "admin") {
      const dashLink = document.querySelector('.navbar-links a[href="dashboard.html"]');
      if (dashLink) {
        dashLink.setAttribute("href", "admin-dashboard.html");
        dashLink.textContent = "Admin Panel";
      }
    }
  } catch (err) {
    console.error("Load profile error:", err);
    showToast("Server error. Is the backend running?", "error");
  }
}

document.getElementById("saveProfileBtn").addEventListener("click", async () => {
  if (!requireAuth()) return;
  const name = nameInput.value.trim();
  if (name.length < 3) { nameError.textContent = "Name must be at least 3 characters."; return; }
  nameError.textContent = "";
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_URL}/auth/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Failed to update", "error"); return; }
    localStorage.setItem("user", JSON.stringify(data.user));
    document.getElementById("userName").textContent = data.user.name;
    showToast("Profile updated!", "success");
  } catch (err) { showToast("Server error", "error"); }
});

document.getElementById("changePasswordBtn").addEventListener("click", async () => {
  if (!requireAuth()) return;
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmNewPassword").value;

  const curErr = document.getElementById("currentPasswordError");
  const newErr = document.getElementById("newPasswordError");
  const confErr = document.getElementById("confirmNewPasswordError");
  curErr.textContent = newErr.textContent = confErr.textContent = "";

  if (!currentPassword) { curErr.textContent = "Enter your current password."; return; }
  if (newPassword.length < 6) { newErr.textContent = "New password must be at least 6 characters."; return; }
  if (newPassword !== confirm) { confErr.textContent = "Passwords do not match."; return; }

  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_URL}/auth/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Failed to change password", "error"); return; }
    showToast("Password changed successfully!", "success");
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmNewPassword").value = "";
  } catch (err) { showToast("Server error", "error"); }
});

loadProfile();
