const API_URL = "http://localhost:5000/api";

function getUser() { try { return JSON.parse(localStorage.getItem("user")); } catch (e) { return null; } }

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

function checkAdmin() {
  const user = getUser();
  const token = localStorage.getItem("token");
  if (!token || !user || user.role !== "admin") { window.location.href = "login.html"; return false; }
  return true;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const tableBody = document.getElementById("usersTableBody");
let allUsers = [];

async function loadUsers() {
  if (!checkAdmin()) return;
  const token = localStorage.getItem("token");
  const me = getUser();
  document.getElementById("adminName").textContent = me.name || "Admin";
  tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Loading...</td></tr>`;
  try {
    const res = await fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Failed to load users", "error"); return; }
    allUsers = data.users;
    renderUsers();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Server error. Is the backend running?</td></tr>`;
  }
}

function renderUsers() {
  tableBody.innerHTML = "";
  if (allUsers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No users found.</td></tr>`;
    return;
  }
  const me = getUser();
  allUsers.forEach((u) => {
    const isSelf = me && u.id === me.id;
    const tr = document.createElement("tr");

    const roleSelect = u.role === "admin"
      ? `<span class="badge badge-admin">Admin</span>`
      : `<button class="btn btn-xs btn-outline" data-action="promote" data-id="${u.id}" ${isSelf ? "disabled" : ""}>Make Admin</button>`;

    const statusBadge = u.disabled
      ? `<span class="badge badge-disabled">Disabled</span>`
      : `<span class="badge badge-active">Active</span>`;

    tr.innerHTML = `
      <td><strong>${escapeHtml(u.name)}</strong></td>
      <td>${escapeHtml(u.email)}</td>
      <td>${roleSelect}</td>
      <td>${u.complaintCount}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td>${statusBadge}</td>
      <td>
        ${isSelf ? '<span style="color:#9ca3af;font-size:0.8rem;">(you)</span>' : `
          <button class="btn btn-xs btn-outline" data-action="toggle-status" data-id="${u.id}" data-disabled="${u.disabled ? 1 : 0}">
            ${u.disabled ? "Enable" : "Disable"}
          </button>
          <button class="btn btn-xs btn-danger" data-action="delete" data-id="${u.id}">Delete</button>
        `}
      </td>
    `;
    tableBody.appendChild(tr);
  });

  tableBody.querySelectorAll("[data-action='promote']").forEach((b) => b.addEventListener("click", () => promoteUser(b.dataset.id)));
  tableBody.querySelectorAll("[data-action='toggle-status']").forEach((b) => b.addEventListener("click", () => toggleStatus(b.dataset.id, b.dataset.disabled === "1")));
  tableBody.querySelectorAll("[data-action='delete']").forEach((b) => b.addEventListener("click", () => deleteUser(b.dataset.id)));
}

async function promoteUser(id) {
  if (!checkAdmin()) return;
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/admin/users/${id}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role: "admin" }),
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || "Failed", "error"); return; }
  showToast(data.message, "success");
  loadUsers();
}

async function toggleStatus(id, currentlyDisabled) {
  if (!checkAdmin()) return;
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/admin/users/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ disabled: !currentlyDisabled }),
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || "Failed", "error"); return; }
  showToast(data.message, "success");
  loadUsers();
}

async function deleteUser(id) {
  if (!checkAdmin()) return;
  if (!confirm("Are you sure you want to delete this user? Their complaints will be detached.")) return;
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/admin/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || "Failed to delete", "error"); return; }
  showToast(data.message, "success");
  loadUsers();
}

loadUsers();
