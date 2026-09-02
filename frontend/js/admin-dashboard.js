const API_URL = "http://localhost:5000/api";

// ===== CHECK ADMIN ROLE =====
function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

// Set the admin name in the navbar.
function setAdminName() {
  const el = document.getElementById("adminName");
  const user = getUser();
  if (el && user) el.textContent = user.name || "Admin";
}

// Logout: clear local session and go to landing.
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

function checkAdmin() {
  const user = getUser();
  const token = localStorage.getItem("token");
  if (!token || !user || user.role !== "admin") {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// ===== RENDER A GENERIC BAR CHART =====
function renderBarChart(containerId, counts) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const entries = Object.entries(counts || {});
  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-state">No data.</p>`;
    return;
  }

  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  entries.sort((a, b) => b[1] - a[1]);
  entries.forEach(([label, count]) => {
    const percentage = Math.round((count / total) * 100);
    const key = label.toLowerCase();

    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div class="chart-row-label">
        <span>${escapeHtml(label)}</span>
        <span class="chart-count">${count} (${percentage}%)</span>
      </div>
      <div class="chart-track"><div class="chart-fill ${key}" style="width:${percentage}%;"></div></div>
    `;
    container.appendChild(row);
  });
}

// ===== RENDER ANALYTICS =====
function renderAnalytics(data) {
  const { stats, categories, priorities, performance } = data;

  document.getElementById("totalCount").textContent = stats.total;
  document.getElementById("pendingCount").textContent = stats.pending;
  document.getElementById("progressCount").textContent = stats.inProgress;
  document.getElementById("resolvedCount").textContent = stats.resolved;
  document.getElementById("escalatedCount").textContent = stats.escalated;
  const closed = document.getElementById("closedCount");
  if (closed) closed.textContent = stats.closed;

  renderBarChart("categoryBreakdown", categories);
  renderBarChart("priorityBreakdown", priorities);
  renderBarChart("departmentBreakdown", data.departments);

  // Performance
  const perfEl = document.getElementById("performanceList");
  perfEl.innerHTML = `
    <div class="performance-item">
      <span class="perf-label">Resolved / Closed</span>
      <span class="perf-value">${performance.resolvedCount}</span>
    </div>
    <div class="performance-item">
      <span class="perf-label">Avg Resolution Time</span>
      <span class="perf-value">${performance.avgResolutionHours === null ? "—" : performance.avgResolutionHours + " hrs"}</span>
    </div>
    <div class="performance-item">
      <span class="perf-label">SLA-Breached</span>
      <span class="perf-value" style="color:${performance.slaBreachedCount > 0 ? "#dc2626" : "#16a34a"};">${performance.slaBreachedCount}</span>
    </div>
  `;
}

// ===== FETCH ANALYTICS =====
async function loadAdminDashboard() {
  if (!checkAdmin()) return;

  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_URL}/admin/analytics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Failed to load analytics", "error");
      return;
    }

    renderAnalytics(data);
  } catch (err) {
    console.error("Load admin dashboard error:", err);
    showToast("Server error. Make sure the backend is running.", "error");
  }
}

// ===== HELPER =====
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ===== INITIALIZE =====
setAdminName();
loadAdminDashboard();
