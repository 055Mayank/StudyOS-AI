const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/rateLimiter");
const { parseFile } = require("../services/fileParser");
const { runPipeline } = require("../services/llmOrchestrator");
const { createJob, processJob, updateJob } = require("../services/jobQueue");

const router = express.Router();
const prisma = new PrismaClient();

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "25");
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|pptx|doc)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, and PPTX files are allowed"));
    }
  },
});

// POST /upload
router.post("/", requireAuth, uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const courseTag = req.body.courseTag || "General";
  const jobId = uuidv4();

  try {
    // Upsert demo user in DB
    let userId = req.user.id;
    try {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: req.user.email || `${userId}@demo.com` },
      });
    } catch {}

    // Create document record
    const doc = await prisma.document.create({
      data: {
        userId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        filePath: req.file.path,
        courseTag,
        processingStatus: "processing",
        jobId,
      },
    });

    createJob(jobId, doc.id);

    // Run pipeline async
    processJob(jobId, async (onProgress) => {
      // 1. Parse file immediately
      const parsed = await parseFile(req.file.path, req.file.mimetype);
      onProgress(20);

      // 2. Immediately upsert extracted content so it is never missing even while AI runs
      const initialStructured = {
        subject: (parsed.sections && parsed.sections[0]?.heading) || courseTag,
        mainTopics: (parsed.sections || []).slice(0, 10).map(s => s.heading).filter(Boolean),
        keyTerms: [],
        sections: (parsed.sections || []).map(s => ({ heading: s.heading, summary: s.body.slice(0, 300), keyPoints: [] })),
      };

      await prisma.extractedContent.upsert({
        where: { documentId: doc.id },
        update: {
          rawText: parsed.rawText || "",
          sections: JSON.stringify(parsed.sections || []),
        },
        create: {
          documentId: doc.id,
          structuredJson: JSON.stringify(initialStructured),
          rawText: parsed.rawText || "",
          sections: JSON.stringify(parsed.sections || []),
        },
      });

      // 3. Run LLM pipeline with documentId for verification & logging
      const { structuredJson, notes, flashcards, summary, deadlines } = await runPipeline(parsed, courseTag, onProgress, doc.id);

      // 4. Update extracted content with full structured JSON
      await prisma.extractedContent.update({
        where: { documentId: doc.id },
        data: { structuredJson: JSON.stringify(structuredJson) },
      });

      // 5. Store notes
      if (notes && notes.length > 0) {
        await prisma.note.create({ data: { documentId: doc.id, content: JSON.stringify(notes) } });
      }

      // 6. Store flashcards
      if (flashcards && flashcards.length > 0) {
        for (const card of flashcards) {
          try {
            await prisma.flashcard.create({ data: { documentId: doc.id, front: card.front, back: card.back } });
          } catch {}
        }
      }

      // 7. Store summary
      if (summary) {
        await prisma.summary.create({
          data: {
            documentId: doc.id,
            tldr: summary.tldr || "",
            takeaways: JSON.stringify(summary.takeaways || []),
            actionItems: JSON.stringify(summary.actionItems || []),
          },
        });
      }

      // 8. Store deadlines
      if (deadlines && deadlines.length > 0) {
        for (const dl of deadlines) {
          try {
            await prisma.deadline.create({
              data: { userId, title: dl.title, course: dl.course || courseTag, dueDate: new Date(dl.dueDate), source: dl.source || "upload" },
            });
          } catch {}
        }
      }

      await prisma.document.update({ where: { id: doc.id }, data: { processingStatus: "done" } });
    }).catch(err => {
      console.error(`[Upload Pipeline Notice for doc ${doc.id}]:`, err.message);
      prisma.document.update({ where: { id: doc.id }, data: { processingStatus: "done" } }).catch(() => {});
      updateJob(jobId, "done", { warning: err.message });
    });

    res.json({ success: true, jobId, documentId: doc.id, message: "Processing started" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
