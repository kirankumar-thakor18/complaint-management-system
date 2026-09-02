// ===== SMART PRIORITY DETECTION (Rule-based, NOT AI/ML) =====
//
// This service analyzes complaint category/title/description and suggests
// a priority using a simple scoring system. It is intentionally simple and
// easy to modify: adjust keyword lists or category weights below.

const PRIORITIES = ["Low", "Medium", "High", "Critical"];

// Categories that automatically boost priority (score added to total).
const CATEGORY_WEIGHTS = {
  Electrical: 2,
  Security: 2,
  Maintenance: 1,
  "IT/Network": 1,
  "Food/Mess": 0,
  Sanitation: 1,
  Other: 0,
};

// Keywords -> score. Critical keywords score highest.
const KEYWORD_SCORES = [
  // Critical keywords
  { keywords: ["safety", "emergency", "fire", "accident", "lift stuck", "trapped", "security threat", "electrical danger", "gas leak", "major outage", "person hurt", "risk of life"], score: 4 },
  // High keywords
  { keywords: ["urgent", "immediately", "dangerous", "not working", "severe", "broken", "security issue", "electrical issue", "smoke"], score: 3 },
  // Medium keywords
  { keywords: ["issue", "problem", "slow", "delay", "maintenance", "water", "wi-fi", "wifi", "cleanliness", "leak", "no ac", "not cooling"], score: 2 },
];

// Thresholds to map final score to a priority level.
function scoreToPriority(score) {
  if (score >= 6) return "Critical";
  if (score >= 4) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

/**
 * Suggest a priority for a complaint based on category, title and description.
 * @param {string} title
 * @param {string} category
 * @param {string} description
 * @returns {string} "Low" | "Medium" | "High" | "Critical"
 */
function suggestPriority(title, category, description) {
  const combinedText = `${title || ""} ${description || ""}`.toLowerCase();

  let score = 0;

  // Add category weight (if a rule exists for this category).
  if (category && CATEGORY_WEIGHTS[category] !== undefined) {
    score += CATEGORY_WEIGHTS[category];
  }

  // Add keyword scores.
  for (const rule of KEYWORD_SCORES) {
    for (const keyword of rule.keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        score += rule.score;
        break; // count a keyword group once
      }
    }
  }

  return scoreToPriority(score);
}

module.exports = { suggestPriority, PRIORITIES };
