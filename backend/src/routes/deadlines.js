const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET /deadlines — fetch real user deadlines (manual + synced Classroom)
router.get("/", requireAuth, async (req, res) => {
  try {
    const deadlines = await prisma.deadline.findMany({
      where: { userId: req.user.id },
      orderBy: { dueDate: "asc" },
    });
    res.json({ deadlines });
  } catch (err) {
    console.error("[Deadlines Error]:", err.message);
    res.json({ deadlines: [] });
  }
});

// POST /deadlines — add manual deadline
router.post("/", requireAuth, async (req, res) => {
  const { title, course, dueDate } = req.body;
  if (!title || !dueDate) return res.status(400).json({ error: "title and dueDate are required" });

  try {
    const dl = await prisma.deadline.create({
      data: {
        userId: req.user.id,
        title: title.trim(),
        course: course ? course.trim() : "General",
        dueDate: new Date(dueDate),
        source: "manual",
      },
    });
    res.json({ deadline: dl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /deadlines/:id — remove deadline
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await prisma.deadline.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
