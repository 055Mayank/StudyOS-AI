import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "../src");
const cssPath = path.resolve(srcDir, "index.css");

test("1. A11y CSS - Focus Indicators (:focus-visible) defined with contrast ring", () => {
  const css = fs.readFileSync(cssPath, "utf-8");
  assert.ok(css.includes(":focus-visible"), "CSS must declare :focus-visible rules for keyboard accessibility");
  assert.ok(css.includes("--focus-ring"), "CSS must define --focus-ring token");
  assert.ok(css.includes("outline:"), "Must set explicit visible outline on focused elements");
});

test("2. A11y CSS - Reduced Motion media query implemented", () => {
  const css = fs.readFileSync(cssPath, "utf-8");
  assert.ok(
    css.includes("@media (prefers-reduced-motion: reduce)"),
    "Must implement prefers-reduced-motion to accommodate users with vestibular sensitivity"
  );
  assert.ok(
    css.includes("animation-duration: 0.001ms") || css.includes("animation: none") || css.includes("animation-duration: 0.01ms"),
    "Must neutralize animations under reduced motion"
  );
});

test("3. A11y CSS - Screen reader (.sr-only) & Skip-link utility classes", () => {
  const css = fs.readFileSync(cssPath, "utf-8");
  assert.ok(css.includes(".sr-only"), "Must provide .sr-only class for visually hidden announcements");
  assert.ok(css.includes(".skip-link"), "Must provide .skip-link styles for keyboard users");
  assert.ok(css.includes("clip: rect"), ".sr-only must use standard accessible clip rect");
});

test("4. A11y App - Skip Link and polite live region declared in App.jsx", () => {
  const appPath = path.resolve(srcDir, "App.jsx");
  const appCode = fs.readFileSync(appPath, "utf-8");

  assert.ok(appCode.includes('href="#main-content"'), "App.jsx must render a skip-link targeting #main-content");
  assert.ok(appCode.includes('aria-live="polite"'), "App.jsx must declare an aria-live polite region for toast/status updates");
  assert.ok(appCode.includes('id="main-content"'), "App.jsx must render <main id='main-content'>");
});

test("5. A11y Sidebar - Tablist semantics, tab roles, and document labels", () => {
  const sidebarPath = path.resolve(srcDir, "components/Sidebar.jsx");
  const code = fs.readFileSync(sidebarPath, "utf-8");

  assert.ok(code.includes('role="tablist"'), "Sidebar must use role='tablist' on navigation");
  assert.ok(code.includes('role="tab"'), "Navigation buttons must have role='tab'");
  assert.ok(code.includes("aria-selected="), "Tabs must announce aria-selected state");
  assert.ok(code.includes("aria-controls="), "Tabs must declare aria-controls for their tabpanels");
  assert.ok(code.includes("ArrowDown") && code.includes("ArrowUp"), "Sidebar must support Arrow key tab navigation");
  assert.ok(code.includes("aria-label="), "Interactive buttons must provide accessible aria-labels");
});

test("6. A11y NotesTab - Accordion accessibility with aria-expanded and aria-controls", () => {
  const notesPath = path.resolve(srcDir, "components/NotesTab.jsx");
  const code = fs.readFileSync(notesPath, "utf-8");

  assert.ok(code.includes("aria-expanded="), "Accordion headers must declare aria-expanded state");
  assert.ok(code.includes("aria-controls="), "Accordion headers must declare aria-controls targeting section body");
  assert.ok(code.includes('role="region"'), "Collapsible content bodies must have role='region'");
});

test("7. A11y FlashcardsTab - Live screen reader announcements & keyboard support", () => {
  const fcPath = path.resolve(srcDir, "components/FlashcardsTab.jsx");
  const code = fs.readFileSync(fcPath, "utf-8");

  assert.ok(code.includes('aria-live="polite"'), "FlashcardsTab must announce current card & flip state to screen readers");
  assert.ok(code.includes('role="progressbar"'), "Flashcard progress indicator must use role='progressbar'");
  assert.ok(code.includes("aria-valuenow="), "Progressbar must declare aria-valuenow");
  assert.ok(code.includes('role="group"'), "Rating controls must be grouped with role='group'");
});

test("8. A11y SummaryTab - Accessible action item checkboxes and keyboard triggers", () => {
  const sumPath = path.resolve(srcDir, "components/SummaryTab.jsx");
  const code = fs.readFileSync(sumPath, "utf-8");

  assert.ok(code.includes('role="checkbox"'), "Action items must have role='checkbox'");
  assert.ok(code.includes("aria-checked="), "Action items must declare aria-checked state");
  assert.ok(code.includes("Enter") || code.includes(" "), "Action items must toggle via keyboard Enter or Space");
});

test("9. A11y DeadlinesTab & SettingsTab - Explicit form label bindings (<label htmlFor>)", () => {
  const dlPath = path.resolve(srcDir, "components/DeadlinesTab.jsx");
  const dlCode = fs.readFileSync(dlPath, "utf-8");
  assert.ok(dlCode.includes('htmlFor="new-deadline-title"'), "Title input must have explicit label htmlFor binding");
  assert.ok(dlCode.includes('htmlFor="new-deadline-course"'), "Course input must have explicit label htmlFor binding");
  assert.ok(dlCode.includes('htmlFor="new-deadline-date"'), "Date input must have explicit label htmlFor binding");

  const setPath = path.resolve(srcDir, "components/SettingsTab.jsx");
  const setCode = fs.readFileSync(setPath, "utf-8");
  assert.ok(setCode.includes('htmlFor="settings-display-name"'), "Display name must have explicit label binding");
  assert.ok(setCode.includes('htmlFor="settings-email"'), "Email must have explicit label binding");
  assert.ok(setCode.includes('htmlFor="settings-gemini-key"'), "API key must have explicit label binding");
});
