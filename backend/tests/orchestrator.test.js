const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDeterministicContent } = require("../src/services/llmOrchestrator");

test("1. Backend llmOrchestrator - buildDeterministicContent produces complete fallback materials", () => {
  const parsedContent = {
    rawText: "Computer Architecture: Instruction Set Architecture and Pipelining. Instruction pipelining is a technique used in modern microprocessors to increase their instruction throughput. Hazards include structural hazards, data hazards, and control hazards. Branch prediction reduces control hazard stalls in pipeline execution.",
    sections: [
      {
        heading: "Pipelining Fundamentals",
        body: "Instruction pipelining is a technique used in modern microprocessors to increase their instruction throughput.",
      },
      {
        heading: "Pipeline Hazards and Solutions",
        body: "Hazards include structural hazards, data hazards, and control hazards. Branch prediction reduces control hazard stalls in pipeline execution.",
      },
    ],
  };

  const result = buildDeterministicContent(parsedContent, "CS 301");

  // Validate Structured Content
  assert.ok(result.structuredJson, "Must return structuredJson");
  assert.strictEqual(result.structuredJson.subject, "Pipelining Fundamentals");
  assert.ok(Array.isArray(result.structuredJson.mainTopics), "mainTopics must be an array");
  assert.ok(Array.isArray(result.structuredJson.keyTerms), "keyTerms must be an array");

  // Validate Notes
  assert.ok(Array.isArray(result.notes), "notes must be an array");
  assert.ok(result.notes.length >= 2, "must generate notes for each section");
  assert.ok(result.notes[0].heading.includes("Pipelining Fundamentals"));
  assert.ok(Array.isArray(result.notes[0].body), "note body must be an array");

  // Validate Flashcards
  assert.ok(Array.isArray(result.flashcards), "flashcards must be an array");
  assert.ok(result.flashcards.length > 0, "flashcards must not be empty");
  assert.ok(result.flashcards[0].front && result.flashcards[0].back, "flashcard must have front and back");

  // Validate Summary
  assert.ok(result.summary, "summary must exist");
  assert.ok(result.summary.tldr.length > 10, "tldr must be a meaningful string");
  assert.ok(Array.isArray(result.summary.takeaways), "takeaways must be an array");
  assert.ok(Array.isArray(result.summary.actionItems), "actionItems must be an array");
  assert.strictEqual(result.summary.actionItems[0].done, false);
});
