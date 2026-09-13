const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { getAuthUrl, getGoogleLoginUrl, getClassroomAuthUrl, exchangeCode, listCourses, listCourseWork } = require("../services/classroomClient");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
}

// GET /auth/me — get current authenticated user profile & stats
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        authProvider: true,
        googleRefreshToken: true,
        createdAt: true,
        _count: {
          select: { documents: true, deadlines: true },
        },
      },
    });

    if (!user) {
      return res.json({
        user: {
          id: req.user.id,
          email: req.user.email || "student@example.com",
          name: req.user.name || "Student",
          authProvider: "local",
          hasClassroom: false,
          stats: { documents: 0, deadlines: 0 },
        },
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split("@")[0],
        authProvider: user.authProvider,
        hasClassroom: !!user.googleRefreshToken,
        stats: {
          documents: user._count?.documents || 0,
          deadlines: user._count?.deadlines || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /google/login-url — for standard Sign in with Google (non-sensitive scopes)
router.get("/google/login-url", (req, res) => {
  try {
    const url = getGoogleLoginUrl();
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: "Google Login not configured: " + err.message });
  }
});

// GET /google/url — get OAuth URL for login or classroom
router.get("/google/url", (req, res) => {
  try {
    const type = req.query.type || "login";
    const url = type === "classroom" ? getClassroomAuthUrl() : getGoogleLoginUrl();
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env" });
  }
});

// GET /google/callback — exchange code
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}?error=missing_code`);
    }

    const tokens = await exchangeCode(code);

    // Get user info from Google
    const { google } = require("googleapis");
    const auth = new google.auth.OAuth2();
    auth.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth });
    const info = await oauth2.userinfo.get();

    const userEmail = info.data.email;
    const userName = info.data.name || userEmail.split("@")[0];
    const userPicture = info.data.picture || null;

    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userName,
          authProvider: "google",
          googleRefreshToken: tokens.refresh_token || null,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: userName || user.name,
          authProvider: "google",
          googleRefreshToken: tokens.refresh_token || user.googleRefreshToken,
        },
      });
    }

    // If this was a classroom authorization, attempt to sync deadlines immediately
    if (state === "classroom" && (tokens.refresh_token || user.googleRefreshToken)) {
      try {
        const classroomTokens = { refresh_token: tokens.refresh_token || user.googleRefreshToken };
        const courses = await listCourses(classroomTokens);
        for (const course of courses.slice(0, 5)) {
          const cwList = await listCourseWork(classroomTokens, course.id);
          for (const cw of cwList) {
            if (cw.dueDate) {
              const { year, month, day } = cw.dueDate;
              const due = new Date(year, month - 1, day);
              await prisma.deadline.create({
                data: {
                  userId: user.id,
                  title: cw.title || "Assignment",
                  course: course.name,
                  dueDate: due,
                  source: "classroom",
                  sourceId: cw.id,
                },
              }).catch(() => {});
            }
          }
        }
      } catch (syncErr) {
        console.warn("[Classroom initial sync warning]:", syncErr.message);
      }
    }

    const token = signToken(user);
    const statusParam = state === "classroom" ? "classroom_connected" : "login_success";
    const redirectUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}?token=${token}&status=${statusParam}&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || "")}${userPicture ? `&picture=${encodeURIComponent(userPicture)}` : ""}`;
    
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[Google OAuth Error]:", err.message);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}?error=${encodeURIComponent(err.message || "oauth_failed")}`);
  }
});

module.exports = router;
