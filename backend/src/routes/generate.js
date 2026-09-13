const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { generationLimiter } = require("../middleware/rateLimiter");
const { generateNotes, generateFlashcards, generateSummary } = require("../services/llmOrchestrator");

const router = express.Router();
const prisma = new PrismaClient();

// POST /generate/notes
router.post("/notes", requireAuth, generationLimiter, async (req, res) => {
  const { documentId, force } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId is required" });

  try {
    // If force=true, clear existing cached notes so we re-generate fresh
    if (force) {
      await prisma.note.deleteMany({ where: { documentId } });
    }

    // 1. Check if notes already exist for this document
    const existing = await prisma.note.findFirst({
      where: { documentId },
      orderBy: { generatedAt: "desc" },
    });
    if (existing) {
      return res.json({ notes: JSON.parse(existing.content), fromCache: true });
    }

    // 2. Fetch extracted content for this specific document
    const extracted = await prisma.extractedContent.findUnique({ where: { documentId } });
    if (!extracted) {
      return res.status(404).json({
        error: "Document content is still processing or has not been extracted yet. Please wait a moment and try again.",
      });
    }

    // 3. Generate notes using this document's extracted structure
    const structuredJson = JSON.parse(extracted.structuredJson);
    const notes = await generateNotes(structuredJson, structuredJson.subject || "General", documentId);

    // 4. Save to database
    await prisma.note.create({ data: { documentId, content: JSON.stringify(notes) } });

    res.json({ notes, fromCache: false });
  } catch (err) {
    console.error(`[Generate Notes Error for ${documentId}]:`, err.message);
    res.status(500).json({ error: err.message || "Failed to generate notes. Please try again." });
  }
});

// POST /generate/flashcards
router.post("/flashcards", requireAuth, generationLimiter, async (req, res) => {
  const { documentId, force } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId is required" });

  try {
    // If force=true, clear existing cached flashcards so we re-generate fresh
    if (force) {
      await prisma.flashcard.deleteMany({ where: { documentId } });
    }

    // 1. Check if flashcards already exist for this document
    const existing = await prisma.flashcard.findMany({ where: { documentId } });
    if (existing && existing.length > 0) {
      return res.json({
        flashcards: existing.map(f => ({ front: f.front, back: f.back, difficulty: f.difficulty })),
        fromCache: true,
      });
    }

    // 2. Fetch extracted content for this specific document
    const extracted = await prisma.extractedContent.findUnique({ where: { documentId } });
    if (!extracted) {
      return res.status(404).json({
        error: "Document content is still processing or has not been extracted yet. Please wait a moment and try again.",
      });
    }

    // 3. Generate flashcards using this document's extracted structure
    const structuredJson = JSON.parse(extracted.structuredJson);
    const cards = await generateFlashcards(structuredJson, structuredJson.subject || "General", documentId);

    // 4. Save to database
    for (const card of cards) {
      await prisma.flashcard.create({ data: { documentId, front: card.front, back: card.back } });
    }

    res.json({ flashcards: cards, fromCache: false });
  } catch (err) {
    console.error(`[Generate Flashcards Error for ${documentId}]:`, err.message);
    res.status(500).json({ error: err.message || "Failed to generate flashcards. Please try again." });
  }
});

// POST /generate/summary
router.post("/summary", requireAuth, generationLimiter, async (req, res) => {
  const { documentId, force } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId is required" });

  try {
    // If force=true, clear existing cached summary so we re-generate fresh
    if (force) {
      await prisma.summary.deleteMany({ where: { documentId } });
    }

    // 1. Check if summary already exists for this document
    const existing = await prisma.summary.findFirst({
      where: { documentId },
      orderBy: { generatedAt: "desc" },
    });
    if (existing) {
      return res.json({
        summary: {
          tldr: existing.tldr,
          takeaways: JSON.parse(existing.takeaways || "[]"),
          actionItems: JSON.parse(existing.actionItems || "[]"),
        },
        fromCache: true,
      });
    }

    // 2. Fetch extracted content for this specific document
    const extracted = await prisma.extractedContent.findUnique({ where: { documentId } });
    if (!extracted) {
      return res.status(404).json({
        error: "Document content is still processing or has not been extracted yet. Please wait a moment and try again.",
      });
    }

    // 3. Generate summary using this document's extracted structure
    const structuredJson = JSON.parse(extracted.structuredJson);
    const summary = await generateSummary(structuredJson, structuredJson.subject || "General", documentId);

    // 4. Save to database
    await prisma.summary.create({
      data: {
        documentId,
        tldr: summary.tldr,
        takeaways: JSON.stringify(summary.takeaways || []),
        actionItems: JSON.stringify(summary.actionItems || []),
      },
    });

    res.json({ summary, fromCache: false });
  } catch (err) {
    console.error(`[Generate Summary Error for ${documentId}]:`, err.message);
    res.status(500).json({ error: err.message || "Failed to generate summary. Please try again." });
  }
});

module.exports = router;
