const express = require("express");
const { getJob } = require("../services/jobQueue");
const router = express.Router();

// GET /status/:jobId
router.get("/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ jobId: req.params.jobId, ...job });
});

module.exports = router;
