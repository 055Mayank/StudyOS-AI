const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parseFile } = require("../src/services/fileParser");

test("1. Backend fileParser - parses plain text file into sections and rawText", async () => {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `test_lecture_${Date.now()}.txt`);
  fs.writeFileSync(
    filePath,
    "Operating Systems Lecture 01\n\nVirtual Memory is a memory management technique.\nIt maps virtual addresses to physical addresses.\n\nPaging Architecture\nPaging avoids external fragmentation by dividing physical memory into frames.",
    "utf-8"
  );

  try {
    const result = await parseFile(filePath, "text/plain");
    assert.ok(result.rawText.length > 50, "Raw text should be extracted");
    assert.ok(Array.isArray(result.sections), "Sections must be an array");
    assert.ok(result.sections.length >= 1, "Must extract at least one section");
    assert.strictEqual(result.isScanned, false);
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
});

test("2. Backend fileParser - parses Markdown with headings", async () => {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `test_markdown_${Date.now()}.md`);
  fs.writeFileSync(
    filePath,
    "# Introduction to Computer Networks\nComputer networks connect autonomous computing devices.\n\n# The OSI Model\nThe OSI model has seven layers: Physical, Data Link, Network, Transport, Session, Presentation, Application.\n\n# TCP vs UDP\nTCP is connection-oriented and reliable, whereas UDP is connectionless.",
    "utf-8"
  );

  try {
    const result = await parseFile(filePath, "text/markdown");
    assert.ok(result.rawText.includes("OSI model"), "Raw text must contain markdown content");
    assert.ok(result.sections.length >= 2, "Should identify multiple headings");
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
});
