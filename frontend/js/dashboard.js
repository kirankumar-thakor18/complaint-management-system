const API_URL = "http://localhost:5000/api";

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

// ===== RENDER STATS =====
function renderStats(complaints) {
  const total = complaints.length;
  const pending = complaints.filter(c => c.status === "Pending").length;
  const inProgress = complaints.filter(c => c.status === "In Progress").length;
  const resolved = complaints.filter(c => c.status === "Resolved").length;
  const escalated = complaints.filter(c => c.escalated).length;

  document.getElementById("totalCount").textContent = total;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("progressCount").textContent = inProgress;
  document.getElementById("resolvedCount").textContent = resolved;
  const eso = document.getElementById("escalatedCount");
  if (eso) eso.textContent = escalated;
}

// ===== RENDER COMPLAINTS LIST =====
function renderComplaints(complaints) {
  const listContainer = document.getElementById("complaintsList");
  listContainer.innerHTML = "";

  if (complaints.length === 0) {
    listContainer.innerHTML = `<p class="empty-state">No complaints found. Submit your first complaint!</p>`;
    return;
  }

  complaints.forEach((complaint) => {
    const card = document.createElement("div");
    card.className = "complaint-card complaint-card-clickable" + (complaint.status === "Closed" ? " closed" : "");
    card.addEventListener("click", () => {
      window.location.href = `track-complaint.html?id=${complaint.id}`;
    });

    const statusClass = getStatusClass(complaint.status);
    const priorityClass = getPriorityClass(complaint.priority);
    const escalationBadge = complaint.escalated
      ? `<span class="escalation-badge">🚨 Escalated</span>`
      : "";

    card.innerHTML = `
      <div class="complaint-card-header">
        <h3>${escapeHtml(complaint.title)}</h3>
        <span class="badge ${statusClass}">${complaint.status}</span>
      </div>
      <div class="complaint-card-meta">
        <span class="badge-outline">${escapeHtml(complaint.category)}</span>
        <span class="badge-outline ${priorityClass}">Priority: ${complaint.priority}</span>
        ${escalationBadge}
        <span class="complaint-date">📅 ${formatDate(complaint.createdAt)}</span>
      </div>
    `;

    listContainer.appendChild(card);
  });
}

// ===== HELPERS =====
function getStatusClass(status) {
  if (status === "Pending") return "badge-pending";
  if (status === "In Progress") return "badge-progress";
  if (status === "Resolved") return "badge-resolved";
  if (status === "Closed") return "badge-closed";
  return "";
}

function getPriorityClass(priority) {
  if (priority === "Critical") return "priority-critical";
  if (priority === "High") return "priority-high";
  if (priority === "Medium") return "priority-medium";
  if (priority === "Low") return "priority-low";
  return "";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ===== FETCH COMPLAINTS FROM BACKEND =====
async function loadComplaints() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const userName = document.getElementById("userName");
  const rawUser = localStorage.getItem("user");
  if (userName && rawUser) {
    const u = JSON.parse(rawUser);
    userName.textContent = u.name || "User";
  }

  const listContainer = document.getElementById("complaintsList");
  listContainer.innerHTML = `<p class="empty-state">Loading complaints...</p>`;

  try {
    const res = await fetch(`${API_URL}/complaints`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
      }
      showToast(data.error || "Failed to load complaints", "error");
      return;
    }

    renderStats(data.complaints);
    renderComplaints(data.complaints);
  } catch (err) {
    console.error("Load complaints error:", err);
    listContainer.innerHTML = `<p class="empty-state">Server error. Make sure the backend is running.</p>`;
  }
}

// ===== INITIALIZE =====
loadComplaints();
