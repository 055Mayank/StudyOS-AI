const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/index");

test("1. Backend Express App - mounts health check endpoint", async () => {
  // Test route handler logic
  const req = {};
  let statusResult = null;
  let jsonResult = null;

  const res = {
    status: (code) => { statusResult = code; return res; },
    json: (data) => { jsonResult = data; return res; },
  };

  // Find health route
  const healthRoute = app._router.stack.find(
    (layer) => layer.route && layer.route.path === "/health"
  );

  assert.ok(healthRoute, "Health check route must be registered in router stack");
  const handler = healthRoute.route.stack[0].handle;
  handler(req, res);

  assert.strictEqual(jsonResult.status, "ok");
  assert.ok(jsonResult.timestamp, "Must include ISO timestamp");
});

test("2. Backend Express App - all primary routes mounted", () => {
  const mountedPaths = app._router.stack
    .filter((layer) => layer.name === "router" && layer.regexp)
    .map((layer) => layer.regexp.toString());

  assert.ok(mountedPaths.some(p => p.includes("auth")), "Must mount /auth router");
  assert.ok(mountedPaths.some(p => p.includes("upload")), "Must mount /upload router");
  assert.ok(mountedPaths.some(p => p.includes("documents")), "Must mount /documents router");
  assert.ok(mountedPaths.some(p => p.includes("generate")), "Must mount /generate router");
  assert.ok(mountedPaths.some(p => p.includes("deadlines")), "Must mount /deadlines router");
  assert.ok(mountedPaths.some(p => p.includes("status")), "Must mount /status router");
});
