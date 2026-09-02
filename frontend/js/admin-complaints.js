const API_URL = "http://localhost:5000/api";

let allComplaints = [];

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const escalatedFilter = document.getElementById("escalatedFilter");
const sortOrder = document.getElementById("sortOrder");
const tableBody = document.getElementById("complaintsTableBody");
const resultsCount = document.getElementById("resultsCount");

// ===== CORE FUNCTION: apply search + filters + sort, then render =====
function applyFiltersAndRender() {
  let result = [...allComplaints];

  const searchTerm = searchInput.value.trim().toLowerCase();
  if (searchTerm) {
    result = result.filter(c => (c.title + " " + c.category + " " + (c.assignedTo || "")).toLowerCase().includes(searchTerm));
  }
  if (statusFilter.value) {
    result = result.filter(c => c.status === statusFilter.value);
  }
  if (priorityFilter.value) {
    result = result.filter(c => c.priority === priorityFilter.value);
  }
  if (escalatedFilter.value) {
    const wantEsc = escalatedFilter.value === "yes";
    result = result.filter(c => c.escalated === wantEsc);
  }

  result.sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return sortOrder.value === "newest" ? dateB - dateA : dateA - dateB;
  });

  renderTable(result);
}

// ===== RENDER TABLE ROWS =====
function renderTable(complaints) {
  tableBody.innerHTML = "";
  resultsCount.textContent = `Showing ${complaints.length} of ${allComplaints.length} complaints`;

  if (complaints.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">No complaints match your filters.</td></tr>`;
    return;
  }

  complaints.forEach((complaint) => {
    const row = document.createElement("tr");
    const assignedTo = complaint.assignedTo || "Unassigned";
    const statusClass = getStatusClass(complaint.status);
    const priorityClass = getPriorityClass(complaint.priority);

    // Escalation / SLA cell
    let slaCell = `—`;
    if (complaint.escalated) {
      slaCell = `<span class="escalation-badge">🚨 Escalated</span>`;
    } else if (complaint.slaDeadline) {
      slaCell = `<span class="sla-ok">${formatDateTime(complaint.slaDeadline)}</span>`;
    }

    row.innerHTML = `
      <td>${escapeHtml(complaint.title)}</td>
      <td>${escapeHtml(complaint.category)}</td>
      <td>
        <span class="badge-outline ${priorityClass}">${complaint.priority}</span>
        ${complaint.suggestedPriority ? `<span class="chart-count" style="font-size:0.75rem;">(sug: ${escapeHtml(complaint.suggestedPriority)})</span>` : ""}
      </td>
      <td><span class="badge ${statusClass}">${complaint.status}</span></td>
      <td>${slaCell}</td>
      <td>${escapeHtml(assignedTo)}</td>
      <td>${formatDate(complaint.createdAt)}</td>
      <td><a href="track-complaint.html?id=${complaint.id}" class="table-link">View</a></td>
    `;

    // ---- Quick actions for admin (status, priority, assign) ----
    const actionsCell = document.createElement("td");
    actionsCell.innerHTML = `
      <div class="admin-actions-form">
        <select data-action="status" data-id="${complaint.id}" class="status-dropdown">
          <option value="Pending" ${complaint.status === "Pending" ? "selected" : ""}>Pending</option>
          <option value="In Progress" ${complaint.status === "In Progress" ? "selected" : ""}>In Progress</option>
          <option value="Resolved" ${complaint.status === "Resolved" ? "selected" : ""}>Resolved</option>
          <option value="Closed" ${complaint.status === "Closed" ? "selected" : ""}>Closed</option>
        </select>
        <select data-action="priority" data-id="${complaint.id}">
          <option value="Low" ${complaint.priority === "Low" ? "selected" : ""}>Low</option>
          <option value="Medium" ${complaint.priority === "Medium" ? "selected" : ""}>Medium</option>
          <option value="High" ${complaint.priority === "High" ? "selected" : ""}>High</option>
          <option value="Critical" ${complaint.priority === "Critical" ? "selected" : ""}>Critical</option>
        </select>
        <input type="text" data-id="${complaint.id}" data-action="assign" placeholder="Assign to..." value="${escapeHtml(assignedTo === "Unassigned" ? "" : assignedTo)}" style="width:120px;">
      </div>
    `;
    row.appendChild(actionsCell);

    tableBody.appendChild(row);
  });

  // Bind quick-action handlers.
  document.querySelectorAll("[data-action='status']").forEach((el) => el.addEventListener("change", handleStatusChange));
  document.querySelectorAll("[data-action='priority']").forEach((el) => el.addEventListener("change", handlePriorityChange));
  document.querySelectorAll("[data-action='assign']").forEach((el) => el.addEventListener("change", handleAssignChange));
}

// ===== HANDLE STATUS CHANGE (admin) =====
async function handleStatusChange(e) {
  const complaintId = e.target.dataset.id;
  const newStatus = e.target.value;
  const token = localStorage.getItem("token");
  e.target.disabled = true;

  try {
    const res = await fetch(`${API_URL}/admin/complaints/${complaintId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Failed to update status", "error");
      applyFiltersAndRender();
      return;
    }

    showToast(`Complaint #${complaintId} status updated to "${newStatus}"`, "success");
    const complaint = allComplaints.find(c => c.id.toString() === complaintId.toString());
    if (complaint) {
      complaint.status = newStatus;
      complaint.history = data.complaint.history;
    }
    applyFiltersAndRender();
  } catch (err) {
    console.error("Update status error:", err);
    showToast("Server error. Is the backend running?", "error");
    applyFiltersAndRender();
  }
}

// ===== HANDLE PRIORITY OVERRIDE (admin) =====
async function handlePriorityChange(e) {
  const complaintId = e.target.dataset.id;
  const newPriority = e.target.value;
  const token = localStorage.getItem("token");
  e.target.disabled = true;

  try {
    const res = await fetch(`${API_URL}/admin/complaints/${complaintId}/priority`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ priority: newPriority }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Failed to update priority", "error");
      applyFiltersAndRender();
      return;
    }

    showToast(`Priority overridden to "${newPriority}"`, "success");
    const complaint = allComplaints.find(c => c.id.toString() === complaintId.toString());
    if (complaint) {
      complaint.priority = newPriority;
      complaint.history = data.complaint.history;
      complaint.slaDeadline = data.complaint.slaDeadline;
    }
    applyFiltersAndRender();
  } catch (err) {
    console.error("Update priority error:", err);
    showToast("Server error. Is the backend running?", "error");
    applyFiltersAndRender();
  }
}

// ===== HANDLE ASSIGN (admin) =====
async function handleAssignChange(e) {
  const complaintId = e.target.dataset.id;
  const assignee = e.target.value.trim();
  const token = localStorage.getItem("token");
  if (!assignee) return;
  e.target.disabled = true;

  try {
    const res = await fetch(`${API_URL}/admin/complaints/${complaintId}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ assignee }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Failed to assign", "error");
      applyFiltersAndRender();
      return;
    }

    showToast(`Complaint #${complaintId} assigned to "${assignee}"`, "success");
    const complaint = allComplaints.find(c => c.id.toString() === complaintId.toString());
    if (complaint) {
      complaint.assignedTo = assignee;
      complaint.history = data.complaint.history;
    }
    applyFiltersAndRender();
  } catch (err) {
    console.error("Assign error:", err);
    showToast("Server error. Is the backend running?", "error");
    applyFiltersAndRender();
  }
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

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ===== CHECK ADMIN =====
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

function checkAdmin() {
  const raw = localStorage.getItem("user");
  const user = raw ? JSON.parse(raw) : null;
  const token = localStorage.getItem("token");
  if (!token || !user || user.role !== "admin") {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// ===== LOAD COMPLAINTS =====
async function loadComplaints() {
  if (!checkAdmin()) return;

  const token = localStorage.getItem("token");
  tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API_URL}/complaints/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403) {
        window.location.href = "login.html";
        return;
      }
      showToast(data.error || "Failed to load complaints", "error");
      return;
    }

    allComplaints = data.complaints;
    applyFiltersAndRender();
  } catch (err) {
    console.error("Load complaints error:", err);
    tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Server error. Make sure the backend is running.</td></tr>`;
  }
}

// ===== EVENT LISTENERS FOR FILTER BAR =====
searchInput.addEventListener("input", applyFiltersAndRender);
statusFilter.addEventListener("change", applyFiltersAndRender);
priorityFilter.addEventListener("change", applyFiltersAndRender);
escalatedFilter.addEventListener("change", applyFiltersAndRender);
sortOrder.addEventListener("change", applyFiltersAndRender);

// ===== INITIALIZE =====
loadComplaints();
