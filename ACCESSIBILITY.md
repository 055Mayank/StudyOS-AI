# StudyOS-AI — Accessibility (a11y) & Inclusive Design Report

## Overview
StudyOS-AI is engineered in accordance with **WCAG 2.1 Level AA** standards to deliver an accessible, inclusive, and friction-free experience for students utilizing screen readers, keyboard-only navigation, high-contrast display modes, and motion-reduction settings.

---

## 1. Keyboard Navigation & Focus Management
- **Skip to Main Content Link**: Located at the top of the DOM (`<a href="#main-content" class="skip-link">`), allowing keyboard users to bypass sidebar navigation and immediately interact with the active study materials.
- **Visible High-Contrast Focus Ring**: Implemented globally via `:focus-visible` using a high-contrast outline (`--focus-ring: #D8558A` in light mode, `#F48FB1` in dark mode) with a 2px offset.
- **Arrow Key Tab Traversal**: The primary workspace navigation supports `ArrowUp` and `ArrowDown` keyboard navigation across tabs in addition to standard `Tab` traversal.
- **Interactive Flashcards**:
  - `Space` / `Enter`: Flips card between question and answer.
  - `ArrowLeft` / `ArrowRight`: Navigates to previous / next flashcard.
  - Numeric Keys `1`, `2`, `3`: Instant mastery difficulty ratings (Hard, Good, Easy).
- **Interactive Action Items**: Checkboxes support keyboard toggling via `Space` and `Enter`.
- **Collapsible Note Sections**: Fully expandable/collapsible with `Enter` and `Space`.

---

## 2. Screen Reader Compatibility & ARIA Semantics
- **Landmark Elements**: Full semantic landmark hierarchy using `<header>`, `<nav>`, `<main id="main-content">`, and `<section>`.
- **Tablist / Tab / Tabpanel Pattern**:
  - Sidebar navigation container uses `role="tablist"` with `aria-label="Workspace navigation"`.
  - Individual tab items declare `role="tab"`, unique `id`, `aria-selected`, and `aria-controls`.
  - Workspace content area declares `role="tabpanel"` and `aria-labelledby`.
- **Polite Live Announcements (`aria-live="polite"`)**:
  - Status updates, processing progress, and toast messages are announced politely without interrupting user focus.
  - Flashcard flip states and card indices (`"Card X of Y. Showing Answer: ..."`) are announced in real-time.
- **Progress Indicators**: Flashcard progress bar declares `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- **Form Controls**: All inputs in Settings and Deadlines explicitly associate with `<label htmlFor="...">` elements.
- **Decorative Elements**: All decorative icons use `aria-hidden="true"` to prevent screen reader clutter.

---

## 3. Color Contrast & Visual Design (WCAG 2.1 AA)
- **Contrast Ratios**: All text tokens (`--text`, `--text-muted`, `--text-light`) meet or exceed the 4.5:1 contrast ratio against both light (`#FFFDFB`, `#FEF8F5`) and dark (`#181416`, `#231D20`) surfaces.
- **Status Indicators**: Status notifications combine color with distinct iconography (Checkmark, Alert circle, Loader) to ensure information is never conveyed by color alone.

---

## 4. Vestibular & Motion Sensitivity
- **`prefers-reduced-motion` Support**: Fully implemented in CSS:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
  Users with vestibular disorders or motion sickness preferences will experience instant transitions without spinning animations or pulsing effects.

---

## 5. Automated Accessibility Testing
Automated accessibility tests validate all the above criteria:
```bash
npm run test:a11y
```
