const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { getClassroomAuthUrl, listCourses, listCourseWork, listMaterials } = require("../services/classroomClient");

const router = express.Router();
const prisma = new PrismaClient();

// GET /classroom/oauth-url — returns real Classroom OAuth consent URL
router.get("/oauth-url", (req, res) => {
  try {
    const url = getClassroomAuthUrl();
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: "Google Classroom OAuth configuration error: " + err.message });
  }
});

// POST /classroom/sync — syncs real Google Classroom courses and coursework deadlines
router.post("/sync", requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.googleRefreshToken) {
      return res.status(400).json({
        error: "Google Classroom is not connected. Please click 'Connect Google Classroom' above to authorize access.",
      });
    }

    const tokens = { refresh_token: user.googleRefreshToken, token_type: "Bearer" };
    const courses = await listCourses(tokens);

    let syncedDeadlinesCount = 0;

    for (const course of courses) {
      try {
        const cwList = await listCourseWork(tokens, course.id);
        for (const work of cwList) {
          if (work.dueDate) {
            const { year, month, day } = work.dueDate;
            const due = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
            const deadlineId = `cr-${course.id}-${work.id}`;

            await prisma.deadline.upsert({
              where: { id: deadlineId },
              update: {
                title: work.title,
                dueDate: due,
                course: course.name,
              },
              create: {
                id: deadlineId,
                userId,
                title: work.title,
                course: course.name,
                dueDate: due,
                source: "classroom",
                sourceId: work.id,
              },
            });
            syncedDeadlinesCount++;
          }
        }
      } catch (cwErr) {
        console.warn(`[Classroom CourseWork fetch warning for ${course.name}]:`, cwErr.message);
      }
    }

    res.json({
      success: true,
      courses: courses.length,
      deadlines: syncedDeadlinesCount,
      message: `Successfully synced ${courses.length} course(s) and ${syncedDeadlinesCount} coursework deadline(s) from Google Classroom!`,
    });
  } catch (err) {
    console.error("[Classroom Sync Error]:", err.message);
    res.status(500).json({ error: err.message || "Failed to sync Google Classroom" });
  }
});

// GET /classroom/courses — returns real connected courses
router.get("/courses", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.googleRefreshToken) {
      return res.json({ courses: [], connected: false });
    }

    const tokens = { refresh_token: user.googleRefreshToken };
    const courses = await listCourses(tokens);
    res.json({ courses, connected: true });
  } catch (err) {
    console.warn("[Classroom Courses Fetch Warning]:", err.message);
    res.json({ courses: [], connected: false, error: err.message });
  }
});

module.exports = router;
