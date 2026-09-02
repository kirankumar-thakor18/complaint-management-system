const API_URL = "http://localhost:5000/api";

const complaintForm = document.getElementById("complaintForm");
const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const descriptionInput = document.getElementById("description");
const priorityPreview = document.getElementById("priorityPreview");

const titleError = document.getElementById("titleError");
const categoryError = document.getElementById("categoryError");
const descriptionError = document.getElementById("descriptionError");

// ===== SMART PRIORITY DETECTION (RULE-BASED, NOT AI/ML) =====
// This mirrors the backend service (services/priorityService.js) so the live
// preview matches what the server will store. The server remains the source
// of truth.

const CATEGORY_WEIGHTS = { Electrical: 2, Security: 2, Maintenance: 1, "IT/Network": 1, Sanitation: 1, "Food/Mess": 0, Other: 0 };

const KEYWORD_SCORES = [
  { keywords: ["safety", "emergency", "fire", "accident", "lift stuck", "trapped", "security threat", "electrical danger", "gas leak", "major outage", "person hurt", "risk of life"], score: 4 },
  { keywords: ["urgent", "immediately", "dangerous", "not working", "severe", "broken", "security issue", "electrical issue", "smoke"], score: 3 },
  { keywords: ["issue", "problem", "slow", "delay", "maintenance", "water", "wi-fi", "wifi", "cleanliness", "leak", "no ac", "not cooling"], score: 2 },
];

function scoreToPriority(score) {
  if (score >= 6) return "Critical";
  if (score >= 4) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

function detectPriority(title, category, description) {
  const combinedText = `${title} ${description}`.toLowerCase();
  let score = 0;

  if (category && CATEGORY_WEIGHTS[category] !== undefined) score += CATEGORY_WEIGHTS[category];

  for (const rule of KEYWORD_SCORES) {
    for (const keyword of rule.keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        score += rule.score;
        break;
      }
    }
  }

  return scoreToPriority(score);
}

// ===== LIVE PREVIEW UPDATE =====
function updatePriorityPreview() {
  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const description = descriptionInput.value.trim();

  if (!title && !description && !category) {
    priorityPreview.textContent = "Fill form to see priority";
    priorityPreview.className = "badge-outline priority-badge";
    return;
  }

  const priority = detectPriority(title, category, description);
  priorityPreview.textContent = priority;
  priorityPreview.className = `badge-outline priority-badge priority-${priority.toLowerCase()}`;
}

titleInput.addEventListener("input", updatePriorityPreview);
descriptionInput.addEventListener("input", updatePriorityPreview);
categoryInput.addEventListener("change", updatePriorityPreview);

// ===== VALIDATE ON BLUR =====
titleInput.addEventListener("blur", () => validateTitle());
categoryInput.addEventListener("change", () => validateCategory());
descriptionInput.addEventListener("blur", () => validateDescription());

// ===== CLEAR ERRORS AS USER TYPES =====
titleInput.addEventListener("input", () => {
  if (titleError.textContent) titleError.textContent = "";
});
descriptionInput.addEventListener("input", () => {
  if (descriptionError.textContent) descriptionError.textContent = "";
});

// ===== INDIVIDUAL FIELD VALIDATORS =====
function validateTitle() {
  if (titleInput.value.trim().length < 5) {
    titleError.textContent = "Title must be at least 5 characters.";
    return false;
  }
  titleError.textContent = "";
  return true;
}

function validateCategory() {
  if (!categoryInput.value) {
    categoryError.textContent = "Please select a category.";
    return false;
  }
  categoryError.textContent = "";
  return true;
}

function validateDescription() {
  if (descriptionInput.value.trim().length < 15) {
    descriptionError.textContent = "Description must be at least 15 characters.";
    return false;
  }
  descriptionError.textContent = "";
  return true;
}

// ===== FORM SUBMIT =====
complaintForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const isTitleValid = validateTitle();
  const isCategoryValid = validateCategory();
  const isDescriptionValid = validateDescription();

  if (!(isTitleValid && isCategoryValid && isDescriptionValid)) return;

  const previewPriority = detectPriority(titleInput.value, categoryInput.value, descriptionInput.value);
  const submitBtn = complaintForm.querySelector("button[type='submit']");

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  const token = localStorage.getItem("token");
  if (!token) {
    showToast("Please login first", "error");
    setTimeout(() => (window.location.href = "login.html"), 800);
    return;
  }

  fetch(`${API_URL}/complaints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: titleInput.value,
      category: categoryInput.value,
      description: descriptionInput.value,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        showToast(data.error, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Complaint";
        return;
      }
      showToast(`Complaint submitted! Suggested priority: ${data.suggestedPriority || previewPriority}`, "success");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Complaint";
      complaintForm.reset();
      updatePriorityPreview();
    })
    .catch((err) => {
      console.error("Submit complaint error:", err);
      showToast("Server error. Is the backend running?", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Complaint";
    });
});
