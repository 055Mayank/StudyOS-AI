require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Handle Vercel serverless environment
if (process.env.VERCEL) {
  const tmpDb = "/tmp/dev.db";
  const srcDb = path.join(__dirname, "../prisma/dev.db");
  if (!fs.existsSync(tmpDb) && fs.existsSync(srcDb)) {
    try { fs.copyFileSync(srcDb, tmpDb); } catch {}
  }
  process.env.DATABASE_URL = process.env.DATABASE_URL || "file:/tmp/dev.db";
  process.env.UPLOAD_DIR = "/tmp/uploads";
}

// Ensure upload directory exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here");
  const hasOpenAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here");
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mode: (hasGemini || hasOpenAI) ? "live" : "demo",
    provider: hasGemini ? `Google Gemini (${process.env.GEMINI_MODEL || "gemini-3.6-flash"})` : hasOpenAI ? "OpenAI" : "mock",
  });
});

// =============================================
// ROUTES
// =============================================
app.use("/auth",      require("./routes/auth"));
app.use("/upload",    require("./routes/upload"));
app.use("/documents", require("./routes/documents"));
app.use("/generate",  require("./routes/generate"));
app.use("/deadlines", require("./routes/deadlines"));
app.use("/classroom", require("./routes/classroom"));
app.use("/status",    require("./routes/status"));

// =============================================
// ERROR HANDLER
// =============================================
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `File too large. Max size: ${process.env.MAX_FILE_SIZE_MB || 25}MB` });
  }
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// =============================================
// START (only listen directly when not on Vercel)
// =============================================
if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, () => {
    const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here");
    const hasOpenAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here");
    const provider = hasGemini ? `Google Gemini (${process.env.GEMINI_MODEL || "gemini-flash-lite-latest"})` : hasOpenAI ? "OpenAI" : "DEMO (mock responses)";
    console.log(`
╔════════════════════════════════════════════╗
║      AI Student Workspace — Backend        ║
╠════════════════════════════════════════════╣
║  Port:     ${PORT}                             ║
║  AI Mode:  ${hasGemini || hasOpenAI ? "LIVE" : "DEMO"}                            ║
║  Provider: ${provider.padEnd(31)} ║
║  DB:       ${(process.env.DATABASE_URL || "file:./dev.db").padEnd(31)} ║
╚════════════════════════════════════════════╝
    `);
    if (!hasGemini && !hasOpenAI) {
      console.log("⚠️  No AI API key set — running in demo mode with mock responses.\n");
    } else {
      console.log(`✨ AI Connected via ${provider}!\n`);
    }
  });
}

module.exports = app;
