const rateLimit = require("express-rate-limit");

const generationLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || "15") * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "30"),
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Too many uploads, please slow down." },
});

module.exports = { generationLimiter, uploadLimiter };
