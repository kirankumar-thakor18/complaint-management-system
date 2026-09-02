// ===== REUSABLE TOAST NOTIFICATION =====
// Ye function kisi bhi page se call ho sakta hai: showToast("message", "success")
// Isse hum har jagah alert() use karne se bach jaate hain.

function showToast(message, type = "success") {
  // Purana toast agar already screen pe hai to hata do
  const existingToast = document.querySelector(".toast");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Thodi der baad (3 seconds) automatically fade out ho jayega
  setTimeout(() => {
    toast.classList.add("toast-hide");
    // Animation complete hone ke baad DOM se completely remove karo
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}