const API_URL = "http://localhost:5000/api";

// ===== LOGIN FORM VALIDATION =====
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");

  email.addEventListener("blur", () => validateEmailField(email, emailError));
  password.addEventListener("blur", () => validatePasswordField(password, passwordError));

  email.addEventListener("input", () => {
    if (emailError.textContent) emailError.textContent = "";
  });
  password.addEventListener("input", () => {
    if (passwordError.textContent) passwordError.textContent = "";
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const isEmailValid = validateEmailField(email, emailError);
    const isPasswordValid = validatePasswordField(password, passwordError);

    if (isEmailValid && isPasswordValid) {
      const submitBtn = loginForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";

      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.value, password: password.value }),
        });

        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || "Login failed", "error");
          submitBtn.disabled = false;
          submitBtn.textContent = "Login";
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        showToast("Login successful!", "success");

        setTimeout(() => {
          if (data.user.role === "admin") {
            window.location.href = "admin-dashboard.html";
          } else {
            window.location.href = "dashboard.html";
          }
        }, 600);
      } catch (err) {
        console.error("Login error:", err);
        showToast("Server error. Is the backend running?", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Login";
      }
    }
  });
}

// ===== REGISTER FORM VALIDATION =====
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  const name = document.getElementById("name");
  const regEmail = document.getElementById("regEmail");
  const regPassword = document.getElementById("regPassword");
  const confirmPassword = document.getElementById("confirmPassword");

  const nameError = document.getElementById("nameError");
  const regEmailError = document.getElementById("regEmailError");
  const regPasswordError = document.getElementById("regPasswordError");
  const confirmError = document.getElementById("confirmPasswordError");

  name.addEventListener("blur", () => validateNameField(name, nameError));
  regEmail.addEventListener("blur", () => validateEmailField(regEmail, regEmailError));
  regPassword.addEventListener("blur", () => validatePasswordField(regPassword, regPasswordError));
  confirmPassword.addEventListener("blur", () => validateConfirmField(regPassword, confirmPassword, confirmError));

  [name, regEmail, regPassword, confirmPassword].forEach((field, idx) => {
    const errorEls = [nameError, regEmailError, regPasswordError, confirmError];
    field.addEventListener("input", () => {
      if (errorEls[idx].textContent) errorEls[idx].textContent = "";
    });
  });

  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const isNameValid = validateNameField(name, nameError);
    const isEmailValid = validateEmailField(regEmail, regEmailError);
    const isPasswordValid = validatePasswordField(regPassword, regPasswordError);
    const isConfirmValid = validateConfirmField(regPassword, confirmPassword, confirmError);

    if (isNameValid && isEmailValid && isPasswordValid && isConfirmValid) {
      const submitBtn = registerForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";

      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.value,
            email: regEmail.value,
            password: regPassword.value,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || "Registration failed", "error");
          submitBtn.disabled = false;
          submitBtn.textContent = "Register";
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        showToast("Account created! Redirecting...", "success");

        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 600);
      } catch (err) {
        console.error("Register error:", err);
        showToast("Server error. Is the backend running?", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Register";
      }
    }
  });
}

// ===== VALIDATION HELPER FUNCTIONS =====
function validateEmailField(input, errorEl) {
  if (!isValidEmail(input.value)) {
    errorEl.textContent = "Please enter a valid email address.";
    return false;
  }
  errorEl.textContent = "";
  return true;
}

function validatePasswordField(input, errorEl) {
  if (input.value.length < 6) {
    errorEl.textContent = "Password must be at least 6 characters.";
    return false;
  }
  errorEl.textContent = "";
  return true;
}

function validateNameField(input, errorEl) {
  if (input.value.trim().length < 3) {
    errorEl.textContent = "Name must be at least 3 characters.";
    return false;
  }
  errorEl.textContent = "";
  return true;
}

function validateConfirmField(passwordInput, confirmInput, errorEl) {
  if (confirmInput.value !== passwordInput.value) {
    errorEl.textContent = "Passwords do not match.";
    return false;
  }
  errorEl.textContent = "";
  return true;
}

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
