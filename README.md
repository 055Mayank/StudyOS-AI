# AI-Powered Student Workspace 📚

Transform lecture materials into AI-generated revision notes, flashcards, summaries, and deadline timelines.

## Quick Start

### 1. Backend
```bash
cd backend
npm install
npx prisma db push     # creates SQLite database
npm run dev            # starts on http://localhost:3001
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

### 3. Configure (optional but recommended)
Edit `backend/.env`:
```
OPENAI_API_KEY=sk-...       # enables real AI generation
GOOGLE_CLIENT_ID=...        # enables Classroom sync
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=your-random-secret
```

Without an API key, the app runs in **demo mode** with rich mock data — fully functional for UI exploration.

## Features
- 📝 **Notes** — AI-structured revision notes with key term highlighting
- 🃏 **Flashcards** — 3D flip cards with Easy/Medium/Hard difficulty rating
- ✨ **Summary** — TL;DR + key takeaways + action items checklist
- 📅 **Deadlines** — Timeline view with countdown, manual + Classroom-synced
- 🎓 **Classroom Sync** — OAuth2 Google Classroom integration
- 🌙 **Dark Mode** — Warm charcoal dark theme toggle
- 📱 **Responsive** — Mobile sidebar collapses to hamburger drawer

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Vite + React 18 + Vanilla CSS |
| Backend | Node.js + Express |
| Database | SQLite (Prisma ORM) |
| AI | OpenAI gpt-4o-mini |
| Auth | JWT + Google OAuth2 |
| File Parsing | pdf-parse, mammoth, adm-zip |

## Adding a Real OpenAI Key
1. Get a key from https://platform.openai.com/api-keys
2. Add to `backend/.env`: `OPENAI_API_KEY=sk-...`
3. Restart the backend — it auto-detects and switches to live mode

## Google Classroom Setup
1. Create a project at https://console.cloud.google.com
2. Enable the Google Classroom API
3. Create OAuth2 credentials (Web application type)
4. Add redirect URI: `http://localhost:3001/auth/google/callback`
5. Copy Client ID and Secret to `backend/.env`

## Project Structure
```
ai-student-workspace/
├── frontend/           # Vite + React SPA
│   └── src/
│       ├── components/ # All tab & UI components
│       ├── App.jsx     # Root state + routing
│       └── index.css   # Full design system
└── backend/            # Express API
    └── src/
        ├── routes/     # REST endpoints
        ├── services/   # File parsing, LLM, job queue
        └── middleware/ # Auth, rate limiting
```
