import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFileClient,
  buildDeterministicContentClient,
  getGoogleOAuthUrl,
  ensureSampleDocuments,
  getLocalDocuments,
  saveLocalDocuments,
  getLocalDocumentData,
  saveLocalDocumentData,
  GOOGLE_CLIENT_ID,
} from "../src/services/clientWorkspace.js";

// Setup browser globals for Node.js test environment
globalThis.window = {
  location: {
    origin: "https://frontend-eta-nine-91.vercel.app",
    pathname: "/",
  },
};

const mockStorage = {};
globalThis.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

test("1. parseFileClient - correctly extracts rawText and detects structured sections", async () => {
  const mockFile = {
    name: "Distributed_Systems_Lecture.md",
    type: "text/markdown",
    text: async () => `# Introduction to Distributed Systems
A distributed system consists of multiple autonomous computers that communicate through a computer network.

# Section 1: CAP Theorem
Brewer's theorem states that it is impossible for a distributed data store to simultaneously provide more than two out of three guarantees: Consistency, Availability, and Partition Tolerance.

# Section 2: Consensus Protocols
Paxos and Raft are consensus algorithms used to achieve agreement among distributed processes in fault-tolerant distributed networks.`,
  };

  const parsed = await parseFileClient(mockFile);
  assert.ok(parsed.rawText.length > 50, "Extracted text should be non-empty");
  assert.ok(parsed.sections.length >= 2, "Should detect at least 2 distinct sections from Markdown headings");
  assert.match(parsed.sections[0].heading, /Introduction/i);
});

test("2. buildDeterministicContentClient - generates valid academic schemas", () => {
  const sampleParsed = {
    rawText: "Operating Systems Lecture: Virtual Memory and Paging. Virtual memory provides an illusion of a large contiguous address space. Paging divides virtual memory into fixed-sized blocks called pages. A page fault occurs when a program accesses a page that is mapped in address space, but not loaded in physical memory.",
    sections: [
      {
        heading: "Virtual Memory Fundamentals",
        body: "Virtual memory provides an illusion of a large contiguous address space. Paging divides virtual memory into fixed-sized blocks called pages.",
      },
      {
        heading: "Page Faults and Replacement",
        body: "A page fault occurs when a program accesses a page that is mapped in address space, but not loaded in physical memory.",
      }
    ],
  };

  const result = buildDeterministicContentClient(sampleParsed, "CS 210");

  // Validate Structured JSON
  assert.ok(result.structuredJson, "structuredJson must exist");
  assert.ok(Array.isArray(result.structuredJson.mainTopics), "mainTopics must be an array");
  assert.ok(Array.isArray(result.structuredJson.keyTerms), "keyTerms must be an array");

  // Validate Notes schema
  assert.ok(Array.isArray(result.notes), "notes must be an array");
  assert.ok(result.notes.length > 0, "notes should contain at least 1 section");
  assert.ok(result.notes[0].heading, "note must have heading");
  assert.ok(Array.isArray(result.notes[0].body), "note body must be an array of text chunks");

  // Validate Flashcards schema
  assert.ok(Array.isArray(result.flashcards), "flashcards must be an array");
  assert.ok(result.flashcards.length > 0, "flashcards must have items");
  assert.ok(result.flashcards[0].front, "flashcard must have front question");
  assert.ok(result.flashcards[0].back, "flashcard must have back answer");

  // Validate Summary schema
  assert.ok(result.summary, "summary must exist");
  assert.ok(typeof result.summary.tldr === "string", "summary.tldr must be a string");
  assert.ok(Array.isArray(result.summary.takeaways), "summary.takeaways must be an array");
  assert.ok(Array.isArray(result.summary.actionItems), "summary.actionItems must be an array");
});

test("3. getGoogleOAuthUrl - generates valid Google OAuth 2.0 authorization URL", () => {
  const url = getGoogleOAuthUrl();
  assert.ok(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth"), "Must target Google OAuth v2 endpoint");
  assert.ok(url.includes(`client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}`), "Must contain configured GOOGLE_CLIENT_ID");
  assert.ok(url.includes("response_type=token%20id_token"), "Must request token & id_token for client-side authentication");
  assert.ok(url.includes("scope=openid"), "Must request openid scope");
  assert.ok(url.includes("auth%2Fgoogle%2Fcallback") || url.includes("callback"), "Must contain authorized redirect URI");
});

test("4. LocalStorage Workspace Persistence - saves, retrieves, and updates documents", () => {
  localStorage.clear();

  const doc = {
    id: "test-doc-123",
    filename: "Algorithms.pdf",
    displayName: "Algorithms",
    status: "done",
    courseTag: "CS 101",
  };

  saveLocalDocuments([doc]);
  const loaded = getLocalDocuments();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, "test-doc-123");

  const notesData = [{ heading: "Dynamic Programming", body: [{ text: "Optimal substructure", terms: [] }] }];
  saveLocalDocumentData("test-doc-123", "notes", notesData);
  const retrievedNotes = getLocalDocumentData("test-doc-123", "notes");
  assert.strictEqual(retrievedNotes.length, 1);
  assert.strictEqual(retrievedNotes[0].heading, "Dynamic Programming");
});

test("5. ensureSampleDocuments - auto-seeds high quality materials if workspace empty", () => {
  localStorage.clear();
  const seeded = ensureSampleDocuments();
  assert.ok(seeded.length >= 1, "Must seed at least 1 document");
  assert.strictEqual(seeded[0].id, "doc-distributed-systems");

  const notes = getLocalDocumentData("doc-distributed-systems", "notes");
  const flashcards = getLocalDocumentData("doc-distributed-systems", "flashcards");
  const summary = getLocalDocumentData("doc-distributed-systems", "summary");

  assert.ok(notes && notes.length > 0, "Seeded notes must exist");
  assert.ok(flashcards && flashcards.length > 0, "Seeded flashcards must exist");
  assert.ok(summary && summary.tldr, "Seeded summary must exist");
});
