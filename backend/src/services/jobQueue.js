// =============================================
// JOB QUEUE SERVICE
// In-process async queue with status tracking.
// Interface is compatible with BullMQ for easy swap.
// =============================================

const jobs = new Map(); // jobId -> { status, documentId, error, progress }

/**
 * Create a new job
 * @param {string} jobId
 * @param {string} documentId
 */
function createJob(jobId, documentId) {
  jobs.set(jobId, { status: "pending", documentId, progress: 0, createdAt: Date.now() });
}

/**
 * Update job status
 * @param {string} jobId
 * @param {"pending"|"processing"|"done"|"failed"} status
 * @param {Object} extra
 */
function updateJob(jobId, status, extra = {}) {
  const existing = jobs.get(jobId) || {};
  jobs.set(jobId, { ...existing, status, updatedAt: Date.now(), ...extra });
}

/**
 * Get job status
 * @param {string} jobId
 */
function getJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Process a job asynchronously
 * @param {string} jobId
 * @param {Function} processor - async function to run
 */
async function processJob(jobId, processor) {
  updateJob(jobId, "processing", { progress: 10 });
  try {
    const result = await processor((progress) => updateJob(jobId, "processing", { progress }));
    updateJob(jobId, "done", { progress: 100, result });
  } catch (err) {
    updateJob(jobId, "failed", { error: err.message });
    console.error(`[JobQueue] Job ${jobId} failed:`, err.message);
  }
}

/**
 * Clean up old completed jobs (call periodically)
 */
function cleanOldJobs() {
  const KEEP_MS = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if ((job.status === "done" || job.status === "failed") && now - (job.updatedAt || job.createdAt) > KEEP_MS) {
      jobs.delete(id);
    }
  }
}

// Clean every 5 minutes
setInterval(cleanOldJobs, 5 * 60 * 1000);

module.exports = { createJob, updateJob, getJob, processJob };
