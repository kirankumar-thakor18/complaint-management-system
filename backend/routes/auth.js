// ===== AUTH ROUTES =====
// Mounted at /api/auth

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { handle } = require("../utils/handler");
const { signToken } = require("../middleware/auth");
const { nextId, publicUser, escapeHtmlText } = require("../utils/helpers");
const emailService = require("../services/emailService");

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// POST /api/auth/register
router.post(
  "/register",
  handle(
    async (req, res) => {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
      }
      if (name.trim().length < 3) {
        return res.status(400).json({ error: "Name must be at least 3 characters" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const db = req.db;
      if (db.users.some((u) => u.email === email.toLowerCase())) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const newUser = {
        id: nextId(db.users),
        name: name.trim(),
        email: email.toLowerCase(),
        password: await bcrypt.hash(password, 10),
        role: "user",
        createdAt: new Date().toISOString(),
      };
      db.users.push(newUser);

      res.status(201).json({
        message: "Registration successful",
        token: signToken(newUser),
        user: publicUser(newUser),
      });
    },
    { auth: false }
  )
);

// POST /api/auth/login
router.post(
  "/login",
  handle(
    async (req, res) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const db = req.db;
      const user = db.users.find((u) => u.email === email.toLowerCase());
      const invalid = () => res.status(401).json({ error: "Invalid email or password" });
      if (!user) return invalid();

      if (!(await bcrypt.compare(password, user.password))) return invalid();

      if (user.disabled) {
        return res.status(403).json({ error: "This account has been disabled by an administrator" });
      }

      res.json({ message: "Login successful", token: signToken(user), user: publicUser(user) });
    },
    { auth: false, readOnly: true }
  )
);

// GET /api/auth/me - get current user
router.get(
  "/me",
  handle((req, res) => {
    res.json(publicUser(req.user));
  }, { readOnly: true })
);

// POST /api/auth/logout - JWTs are stateless; the client discards the token.
router.post(
  "/logout",
  handle((req, res) => {
    res.json({ message: "Logged out" });
  }, { readOnly: true })
);

// GET /api/auth/profile - get full profile info
router.get(
  "/profile",
  handle((req, res) => {
    const { id, name, email, role, createdAt } = req.user;
    res.json({ id, name, email, role, createdAt });
  }, { readOnly: true })
);

// PUT /api/auth/profile - update display name
router.put(
  "/profile",
  handle((req, res) => {
    const { name } = req.body;
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ error: "Name must be at least 3 characters" });
    }
    req.user.name = name.trim();
    res.json({ message: "Profile updated", user: publicUser(req.user) });
  })
);

// PUT /api/auth/password - change password (authenticated)
router.put(
  "/password",
  handle(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    if (!(await bcrypt.compare(currentPassword, req.user.password))) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    req.user.password = await bcrypt.hash(newPassword, 10);
    res.json({ message: "Password changed successfully" });
  })
);

// POST /api/auth/forgot-password - send reset link via email
router.post(
  "/forgot-password",
  handle(
    async (req, res) => {
      const { email } = req.body;
      const db = req.db;
      const user = email ? db.users.find((u) => u.email === email.toLowerCase()) : null;

      // Always respond the same to avoid leaking which emails exist.
      const reply = { message: "If that email is registered, a reset link has been sent." };
      if (!user) return res.json(reply);

      // Persisted (not in-memory) so reset links survive a server restart.
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
      db.resetTokens = (db.resetTokens || []).filter((t) => t.expiresAt > Date.now());
      db.resetTokens.push({ token, userId: user.id, expiresAt });

      const resetLink = `${emailService.APP_URL}/reset-password.html?token=${token}`;
      const body = emailService.wrap(`
        <p>Hi <strong>${escapeHtmlText(user.name)}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to choose a new one. This link is valid for <strong>30 minutes</strong>.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${resetLink}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
        </p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `);

      await emailService.sendEmail(user.email, "Reset your password", body);

      // In development (no SMTP configured) the email is only logged, so also
      // return the link in the response to make local testing easy.
      const extra = emailService.isConfigured() ? {} : { devResetLink: resetLink };
      res.json({ ...reply, ...extra });
    },
    { auth: false }
  )
);

// POST /api/auth/reset-password - set new password with a reset token
router.post(
  "/reset-password",
  handle(
    async (req, res) => {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const db = req.db;
      const entry = (db.resetTokens || []).find((t) => t.token === token);
      if (!entry || Date.now() > entry.expiresAt) {
        return res.status(400).json({ error: "Reset link is invalid or has expired" });
      }
      const user = db.users.find((u) => u.id === entry.userId);
      if (!user) {
        return res.status(400).json({ error: "User no longer exists" });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      db.resetTokens = db.resetTokens.filter((t) => t.token !== token); // single use
      res.json({ message: "Password reset successfully. You can now login." });
    },
    { auth: false }
  )
);

module.exports = router;
