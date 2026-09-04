const API_URL = "http://localhost:5000/api";

const forgotForm = document.getElementById("forgotForm");
const email = document.getElementById("email");
const emailError = document.getElementById("emailError");

email.addEventListener("blur", () => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email.value)) { emailError.textContent = "Please enter a valid email address."; return false; }
  emailError.textContent = "";
  return true;
});
email.addEventListener("input", () => { if (emailError.textContent) emailError.textContent = ""; });

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email.value)) { emailError.textContent = "Please enter a valid email address."; return; }
  emailError.textContent = "";

  const btn = forgotForm.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value }),
    });
    const data = await res.json();
    showToast(data.message || "Check your email for the reset link.", "success");
    setTimeout(() => (window.location.href = "login.html"), 1500);
  } catch (err) {
    showToast("Server error. Is the backend running?", "error");
    btn.disabled = false;
    btn.textContent = "Send Reset Link";
  }
});
