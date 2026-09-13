# StudyOS-AI — Testing & Quality Assurance Suite

## Overview
StudyOS-AI features a comprehensive, zero-dependency automated test suite covering unit functionality, component state, accessibility compliance, and backend services.

---

## Quick Start: Running Tests

Run all tests from root:
```bash
npm test
```

Run dedicated suites:
```bash
# Run automated Accessibility (a11y) tests
npm run test:a11y

# Run Frontend unit & component tests
npm run test:frontend

# Run Backend parser, orchestrator & API tests
npm run test:backend
```

---

## Test Suite Architecture

| Suite | Location | Focus Area | Tests | Status |
| :--- | :--- | :--- | :---: | :---: |
| **Accessibility** | `frontend/tests/accessibility.test.js` | WCAG 2.1 AA, Focus rings, ARIA roles, Skip link, Reduced motion | 9 | PASS |
| **Frontend Unit** | `frontend/tests/unit.test.js` | Text parser, deterministic LLM fallback, OAuth URL, LocalStorage | 5 | PASS |
| **Components** | `frontend/tests/components.test.js` | Note highlighting, Flashcard navigation, Action items, Deadlines | 4 | PASS |
| **Backend Parser** | `backend/tests/parser.test.js` | Markdown & text segmentation, heading detection | 2 | PASS |
| **Backend AI** | `backend/tests/orchestrator.test.js` | Deterministic fallback content structuring | 1 | PASS |
| **Backend API** | `backend/tests/api.test.js` | Express router mounting, `/health` endpoint contract | 2 | PASS |
| **Total** | | | **23** | **100% PASS** |

---

## Key Verification Details

1. **Client Parsing & Fallback Engine**:
   - Validates that text and markdown files extract into structured sections with accurate heading detection.
   - Validates deterministic concept extraction fallback produces valid schemas for revision notes, flashcards, and executive summaries.

2. **Google OAuth & Authentication**:
   - Validates that `getGoogleOAuthUrl()` builds standard RFC 6749 authorization requests targeting Google's OAuth 2.0 endpoints with the authorized redirect URI and scopes.
   - Validates in-browser JWT decoding handles valid ID tokens and gracefully rejects malformed strings.

3. **Accessibility Audits**:
   - Automated assertions verify CSS tokens, focus visibility rules, ARIA roles (`tablist`, `tab`, `tabpanel`, `region`, `checkbox`, `progressbar`), and explicit form `<label htmlFor="...">` associations.
