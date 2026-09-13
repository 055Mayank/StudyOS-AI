const express = require("express");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET /documents — list user's uploaded documents with clean display names
router.get("/", requireAuth, async (req, res) => {
  try {
    const rawDocs = await prisma.document.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        originalName: true,
        source: true,
        courseTag: true,
        processingStatus: true,
        createdAt: true,
      },
    });

    const documents = rawDocs.map(d => ({
      id: d.id,
      displayName: d.originalName || d.filename,
      originalName: d.originalName || d.filename,
      filename: d.filename,
      status: d.processingStatus, // normalized status for reactive UI
      processingStatus: d.processingStatus,
      source: d.source,
      courseTag: d.courseTag || "General",
      createdAt: d.createdAt,
    }));

    res.json({ documents });
  } catch (err) {
    console.error("[Documents List Error]:", err.message);
    res.json({ documents: [] });
  }
});

// DELETE /documents/:id — delete document, storage file, and all associated generated data
router.delete("/:id", requireAuth, async (req, res) => {
  const docId = req.params.id;

  try {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Verify ownership (allow demo-user or matching userId)
    if (doc.userId !== req.user.id && req.user.id !== "demo-user") {
      return res.status(403).json({ error: "Unauthorized to delete this document" });
    }

    // 1. Delete physical file from storage if present
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (fileErr) {
        console.warn("[File unlink warning]:", fileErr.message);
      }
    }

    // 2. Delete related deadlines if any
    await prisma.deadline.deleteMany({
      where: {
        userId: req.user.id,
        sourceId: docId,
      },
    }).catch(() => {});

    // 3. Delete Document record (Cascade deletes Note, Flashcard, Summary, ExtractedContent)
    await prisma.document.delete({
      where: { id: docId },
    });

    res.json({ success: true, message: "Document and all generated data deleted successfully", id: docId });
  } catch (err) {
    console.error(`[Delete Document ${docId} Error]:`, err.message);
    res.status(500).json({ error: err.message || "Failed to delete document" });
  }
});

module.exports = router;
