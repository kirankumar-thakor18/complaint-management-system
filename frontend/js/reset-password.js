const API_URL = "http://localhost:5000/api";

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

const resetForm = document.getElementById("resetForm");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const newPasswordError = document.getElementById("newPasswordError");
const confirmError = document.getElementById("confirmError");

if (!token) {
  newPassword.disabled = true;
  confirmPassword.disabled = true;
  document.querySelector("button[type='submit']").disabled = true;
  newPasswordError.textContent = "Invalid or missing reset token.";
}

newPassword.addEventListener("input", () => { if (newPasswordError.textContent) newPasswordError.textContent = ""; });
confirmPassword.addEventListener("input", () => { if (confirmError.textContent) confirmError.textContent = ""; });

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!token) return;

  if (newPassword.value.length < 6) { newPasswordError.textContent = "Password must be at least 6 characters."; return; }
  if (newPassword.value !== confirmPassword.value) { confirmError.textContent = "Passwords do not match."; return; }
  newPasswordError.textContent = confirmError.textContent = "";

  const btn = resetForm.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: newPassword.value }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Failed to reset password", "error"); btn.disabled = false; btn.textContent = "Reset Password"; return; }
    showToast(data.message, "success");
    setTimeout(() => (window.location.href = "login.html"), 1500);
  } catch (err) {
    showToast("Server error. Is the backend running?", "error");
    btn.disabled = false;
    btn.textContent = "Reset Password";
  }
});
