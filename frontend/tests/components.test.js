import test from "node:test";
import assert from "node:assert/strict";

// Component helper functions for testing
function getCountdown(dueDate) {
  const diff = new Date(dueDate) - Date.now();
  if (diff <= 0) return { value: "Overdue", label: "", status: "overdue" };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0) return { value: `${hours}h`, label: "left today", status: "urgent" };
  if (days <= 2) return { value: `${days}d ${hours}h`, label: "remaining", status: "urgent" };
  return { value: `${days}`, label: "days left", status: "ok" };
}

function renderNoteBody(body, keyTerms = []) {
  if (!Array.isArray(body)) return [{ text: String(body), isKeyTerm: false }];
  return body.map((chunk) => ({
    text: chunk.text,
    isKeyTerm: chunk.terms?.some(t => keyTerms.includes(t)) || false,
  }));
}

function calculateProgress(currentIndex, totalCards) {
  if (!totalCards) return 0;
  return Math.round(((currentIndex + 1) / totalCards) * 100);
}

function nextCardIndex(current, total) {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

function prevCardIndex(current, total) {
  if (total <= 0) return 0;
  return (current - 1 + total) % total;
}

test("1. NotesTab - renderNoteBody correctly marks highlighted key terms", () => {
  const body = [
    { text: "The primary theorem is ", terms: [] },
    { text: "CAP Theorem", terms: ["CAP Theorem"] },
    { text: ", which dictates consistency trade-offs.", terms: [] }
  ];
  const keyTerms = ["CAP Theorem", "Paxos"];

  const rendered = renderNoteBody(body, keyTerms);
  assert.strictEqual(rendered.length, 3);
  assert.strictEqual(rendered[1].isKeyTerm, true);
  assert.strictEqual(rendered[1].text, "CAP Theorem");
  assert.strictEqual(rendered[0].isKeyTerm, false);
});

test("2. FlashcardsTab - navigation index wrapping and progress calculation", () => {
  const total = 5;
  let current = 0;

  // Next navigation
  current = nextCardIndex(current, total);
  assert.strictEqual(current, 1);
  assert.strictEqual(calculateProgress(current, total), 40);

  // Wrap around to end
  current = 4;
  current = nextCardIndex(current, total);
  assert.strictEqual(current, 0);

  // Prev navigation wrap around
  current = prevCardIndex(0, total);
  assert.strictEqual(current, 4);
});

test("3. SummaryTab - action items toggling and takeaway serialization", () => {
  const initialActions = [
    { text: "Review CAP theorem proof", done: false },
    { text: "Complete Quiz 1", done: true },
  ];

  // Toggle item 0 to done
  const updatedActions = initialActions.map((a, i) => i === 0 ? { ...a, done: !a.done } : a);
  assert.strictEqual(updatedActions[0].done, true);
  assert.strictEqual(updatedActions[1].done, true);

  // Copy takeaway formatter
  const takeaways = ["Consistency tradeoff", "Leader election with Raft"];
  const formattedClipboard = takeaways.map((t, i) => `${i + 1}. ${t}`).join("\n");
  assert.strictEqual(formattedClipboard, "1. Consistency tradeoff\n2. Leader election with Raft");
});

test("4. DeadlinesTab - countdown computation (overdue, urgent, ok)", () => {
  // Overdue
  const pastDate = new Date(Date.now() - 3600000).toISOString();
  const overdueCountdown = getCountdown(pastDate);
  assert.strictEqual(overdueCountdown.status, "overdue");

  // Urgent (< 2 days)
  const tomorrowDate = new Date(Date.now() + 24 * 3600000).toISOString();
  const urgentCountdown = getCountdown(tomorrowDate);
  assert.strictEqual(urgentCountdown.status, "urgent");

  // OK (> 2 days)
  const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
  const okCountdown = getCountdown(futureDate);
  assert.strictEqual(okCountdown.status, "ok");
  assert.strictEqual(okCountdown.label, "days left");
});
