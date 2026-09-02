const API_URL = "http://localhost:5000/api";

const urlParams = new URLSearchParams(window.location.search);
const complaintId = urlParams.get("id");

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

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function humanReadableAction(action) {
  const map = {
    created: "Complaint Created",
    status_changed: "Status Changed",
    priority_changed: "Priority Changed",
    assigned: "Complaint Assigned",
    escalated: "SLA Exceeded / Escalated",
    resolved: "Complaint Resolved",
    closed: "Complaint Closed",
    feedback_submitted: "Feedback Submitted",
  };
  return map[action] || action;
}

// ===== RENDER COMPLAINT DETAIL =====
function renderComplaintDetail(complaint) {
  const container = document.getElementById("trackContent");

  const statusClass = getStatusClass(complaint.status);
  const priorityClass = getPriorityClass(complaint.priority);
  const assignedTo = complaint.assignedTo || "Not yet assigned";
  const history = Array.isArray(complaint.history) ? complaint.history : [];

  // SLA / escalation info
  let slaHtml = `<p><strong>${complaint.slaDeadline ? formatDateTime(complaint.slaDeadline) : "—"}</strong></p>`;
  if (complaint.escalated) {
    slaHtml += `<p class="sla-overdue">🚨 Overdue (escalated)</p>`;
  }

  const escalationBadge = complaint.escalated
    ? `<span class="escalation-badge">🚨 Escalated</span>`
    : `<span class="escalation-badge none">Not escalated</span>`;

  container.innerHTML = `
    <div class="track-header">
      <div>
        <h1>${escapeHtml(complaint.title)}</h1>
        <div class="complaint-card-meta" style="margin-top:8px;">
          <span class="badge-outline">${escapeHtml(complaint.category)}</span>
          <span class="badge-outline ${priorityClass}">Priority: ${complaint.priority}</span>
          <span class="badge ${statusClass}">${complaint.status}</span>
          ${escalationBadge}
        </div>
      </div>
    </div>

    <div class="form-card" style="margin-top:20px;">
      <h3 style="margin-bottom:10px;">Description</h3>
      <p style="color:#555; line-height:1.5;">${escapeHtml(complaint.description)}</p>

      <div class="track-info-grid">
        <div>
          <p class="stat-label">Submitted On</p>
          <p><strong>${formatDateTime(complaint.createdAt)}</strong></p>
        </div>
        <div>
          <p class="stat-label">Assigned To</p>
          <p><strong>${escapeHtml(assignedTo)}</strong></p>
        </div>
        <div>
          <p class="stat-label">Suggested Priority</p>
          <p><strong>${escapeHtml(complaint.suggestedPriority || complaint.priority)}</strong></p>
        </div>
        <div>
          <p class="stat-label">SLA Deadline</p>
          <div>${slaHtml}</div>
        </div>
      </div>
    </div>

    <div class="form-card" style="margin-top:20px;">
      <h3 style="margin-bottom:20px;">Complaint Timeline</h3>
      <div class="timeline" id="timeline"></div>
    </div>

    <div id="feedbackSection"></div>
  `;

  renderTimeline(history);
  renderFeedbackSection(complaint);
}

// ===== RENDER TIMELINE (chronological, append-only audit log) =====
function renderTimeline(history) {
  const timelineContainer = document.getElementById("timeline");

  if (!history.length) {
    timelineContainer.innerHTML = `<p>No history recorded.</p>`;
    return;
  }

  // Chronological order (oldest first).
  const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  timelineContainer.innerHTML = sorted.map((entry) => {
    const actor = entry.performedBy ? entry.performedBy.name : "System";
    let detail = "";
    if (entry.previousValue && entry.newValue) {
      detail = `: <strong>${escapeHtml(entry.previousValue)}</strong> → <strong>${escapeHtml(entry.newValue)}</strong>`;
    } else if (entry.newValue) {
      detail = `: <strong>${escapeHtml(entry.newValue)}</strong>`;
    }
    const comment = entry.comment ? `<p class="timeline-note">💬 ${escapeHtml(entry.comment)}</p>` : "";

    return `
      <div class="timeline-item timeline-completed">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <p class="timeline-stage">${humanReadableAction(entry.action)}${detail}</p>
          <p class="timeline-timestamp">${formatDateTime(entry.timestamp)} · by ${escapeHtml(actor)}</p>
          ${comment}
        </div>
      </div>
    `;
  }).join("");
}

// ===== FEEDBACK SECTION =====
function renderFeedbackSection(complaint) {
  const container = document.getElementById("feedbackSection");
  const isResolved = ["Resolved", "Closed"].includes(complaint.status);
  const rawUser = localStorage.getItem("user");
  const user = rawUser ? JSON.parse(rawUser) : null;

  if (!isResolved) {
    container.innerHTML = `
      <div class="form-card feedback-card">
        <p class="feedback-note">ℹ️ Feedback will be available once this complaint is resolved or closed.</p>
      </div>
    `;
    return;
  }

  // Let admin view existing feedback rating (if any); users see their own.
  const canSubmit = user && user.role !== "admin";
  container.innerHTML = `
    <div class="form-card feedback-card">
      <h3 style="margin-bottom:10px;">Rate Your Experience</h3>
      ${canSubmit
        ? `
        <div class="star-rating" id="starRating">
          <span class="star" data-value="1">★</span>
          <span class="star" data-value="2">★</span>
          <span class="star" data-value="3">★</span>
          <span class="star" data-value="4">★</span>
          <span class="star" data-value="5">★</span>
        </div>
        <div class="form-group" style="margin-top:12px;">
          <textarea id="feedbackComment" rows="3" placeholder="Optional comment about your experience..." style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:6px;"></textarea>
      </div>
        <button class="btn btn-primary" id="submitFeedback">Submit Feedback</button>
        `
        : `<p class="feedback-note">Viewing as admin — user feedback is shown in the admin feedback section.</p>`
      }
      <div id="feedbackState"></div>
    </div>
  `;

  if (!canSubmit) return;

  let selectedRating = 0;
  const stars = container.querySelectorAll(".star");
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.dataset.value, 10);
      stars.forEach((s) => s.classList.toggle("active", parseInt(s.dataset.value, 10) <= selectedRating));
    });
  });

  document.getElementById("submitFeedback").addEventListener("click", async () => {
    const state = document.getElementById("feedbackState");
    const token = localStorage.getItem("token");
    if (!selectedRating) {
      state.innerHTML = `<p class="feedback-note" style="color:#dc2626;">Please select a star rating.</p>`;
      return;
    }
    const comment = document.getElementById("feedbackComment").value;

    const res = await fetch(`${API_URL}/complaints/${complaint.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: selectedRating, comment }),
    });
    const data = await res.json();
    if (!res.ok) {
      state.innerHTML = `<p class="feedback-note" style="color:#dc2626;">${data.error}</p>`;
      return;
    }
    state.innerHTML = `<p class="feedback-done">✅ Thank you for your feedback (${selectedRating}/5)!</p>`;
    document.getElementById("submitFeedback").disabled = true;
    showToast("Feedback submitted!", "success");
  });
}

// ===== FETCH COMPLAINT =====
async function loadComplaint() {
  const container = document.getElementById("trackContent");
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  if (!complaintId) {
    container.innerHTML = `<p class="empty-state">No complaint ID provided.</p>`;
    return;
  }

  container.innerHTML = `<p class="empty-state">Loading complaint...</p>`;

  try {
    const res = await fetch(`${API_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
      }
      container.innerHTML = `<p class="empty-state">${escapeHtml(data.error) || "Failed to load complaint."}</p>`;
      return;
    }

    renderComplaintDetail(data.complaint);
  } catch (err) {
    console.error("Load complaint error:", err);
    container.innerHTML = `<p class="empty-state">Server error. Make sure the backend is running.</p>`;
  }
}

// ===== INITIALIZE =====
loadComplaint();
