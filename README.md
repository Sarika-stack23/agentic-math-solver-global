# 🧮 AI Math Tutor

**AI-powered math tutoring for students worldwide.** Solve problems, get verified step-by-step solutions, check your work, and practice with personalized exercises.

[![CI/CD Pipeline](https://github.com/Sarika-stack23/agentic-math-solver-global/actions/workflows/ci.yml/badge.svg)](https://github.com/Sarika-stack23/agentic-math-solver-global/actions)

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Solve & Verify** | Multi-agent pipeline: Planner → Solver → Verifier → Formatter. Every solution is checked. |
| **Check My Work** | Submit your own solution — the tutor finds your first mistake, explains why, and suggests how to fix it. |
| **Hint Mode** | 4-level progressive hints: gentle nudge → formula → approach → full solution. |
| **Teach Me** | Socratic guided learning — the tutor asks questions, never gives the answer directly. |
| **Why?** | Tap "Why?" on any step to get a plain-English explanation. |
| **Another Method** | Request a genuinely different approach to the same problem. |
| **Practice** | Generate similar problems at easier/same/harder difficulty. Topic-based practice. |
| **Progress Tracking** | Streaks, accuracy, weak topic detection, activity heatmap, personalized recommendations. |
| **Image Input** | Upload a photo or scan handwritten math — AI extracts and solves. |
| **PDF Upload** | Upload a textbook PDF, then ask questions about it using RAG. |
| **NCERT Practice** | Structured practice from NCERT textbooks (Class 6–12). |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React + Vite Frontend                   │
│  ┌──────┐ ┌───────┐ ┌──────────┐ ┌────────┐ ┌────────┐ │
│  │ Home │ │ Solve │ │ Practice │ │Progress│ │Settings│ │
│  └──────┘ └───────┘ └──────────┘ └────────┘ └────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ REST + SSE
┌────────────────────────┴────────────────────────────────┐
│                  FastAPI Backend                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  LangGraph Pipeline                                │  │
│  │  Classify → Retrieve (RAG) → Solve → Verify → Fmt │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────┐ ┌───────┐ ┌──────────┐          │
│  │Check Work│ │Hints │ │ Teach │ │ Practice │          │
│  └──────────┘ └──────┘ └───────┘ └──────────┘          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  MCP Tool Servers                                  │  │
│  │  SymPy · Calculator · Graph · Python · Vision · PDF│  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────┴───┐    ┌──────┴──────┐   ┌────┴───┐
    │Gemini  │    │  Firebase   │   │ Qdrant │
    │(Free)  │    │ Auth + DB   │   │(Memory)│
    └────────┘    └─────────────┘   └────────┘
```

---

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| **Frontend** | React 19, Vite, TypeScript, KaTeX, Recharts | Free |
| **Backend** | FastAPI, LangGraph, Python 3.11 | Free |
| **Primary LLM** | Google Gemini 2.0 Flash (Google AI Studio) | Free tier |
| **Fallback LLM** | Groq (Llama 3.3 70B) | Free tier |
| **Math Engine** | SymPy, NumPy, SciPy, Matplotlib | Open source |
| **Vector DB** | Qdrant (in-memory) | Free |
| **Auth & DB** | Firebase Auth + Firestore | Free tier |
| **Hosting** | Vercel (frontend) + HuggingFace Spaces (backend) | Free tier |

**Total cost: $0/month** — All services run on free tiers.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 22+
- A Gemini API key ([get one free](https://aistudio.google.com/apikey))

### 1. Clone & Setup

```bash
git clone https://github.com/Sarika-stack23/agentic-math-solver-global.git
cd agentic-math-solver-global
```

### 2. Backend

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run the backend
uvicorn backend.src.main:app --host 0.0.0.0 --port 8080 --reload
```

### 3. Frontend

```bash
cd frontend
npm install --legacy-peer-deps

# Configure API URL
echo "VITE_API_URL=http://localhost:8080" > .env

# Run the frontend
npm run dev
```

### 4. Docker (Alternative)

```bash
docker compose up --build
```

Visit `http://localhost:5173` — the app is ready.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/chat/stream` | Solve a problem (SSE streaming) |
| `POST` | `/api/v1/check-work` | Check student's solution |
| `POST` | `/api/v1/check-work/image` | Check handwritten solution |
| `POST` | `/api/v1/hints` | Get progressive hints (levels 1-4) |
| `POST` | `/api/v1/teach` | Socratic teaching mode |
| `POST` | `/api/v1/practice/generate` | Generate practice problems |
| `POST` | `/api/v1/practice/daily` | Daily practice based on weak topics |
| `POST` | `/api/v1/practice/mistakes/record` | Record a mistake |
| `GET`  | `/api/v1/practice/mistakes` | Get mistakes for review |
| `POST` | `/api/v1/vision/extract` | Extract math from image |
| `POST` | `/api/v1/documents/upload` | Upload and index a PDF |
| `GET`  | `/api/v1/progress` | Get learning progress |
| `GET`  | `/api/v1/quiz/structure` | Get NCERT quiz tree |
| `GET`  | `/health` | Health check |

---

## Project Structure

```
agentic-math-solver-global/
├── backend/
│   ├── src/
│   │   ├── agents/          # ADK agents (Planner, Solver, Verifier, Formatter)
│   │   ├── api/v1/          # REST endpoints (chat, check_work, hints, teach, practice, ...)
│   │   ├── graph/           # LangGraph pipeline + state
│   │   ├── math/            # SymPy engine, graph utils, knowledge indexer
│   │   ├── services/        # Gemini, Firebase, Qdrant, embeddings
│   │   ├── config.py        # Central configuration
│   │   └── main.py          # FastAPI app
│   ├── knowledge-base/      # NCERT + JEE content (markdown)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # React components (Chat, Home, Practice, Dashboard, ...)
│   │   ├── context/         # Auth context
│   │   ├── i18n/            # Internationalization (en.json)
│   │   ├── App.tsx          # Root component + routing
│   │   └── index.css        # Design system
│   ├── package.json
│   └── index.html
├── mcp-servers/             # 6 MCP tool servers
├── tests/                   # Backend test suite
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Internationalization

All UI strings are centralized in `frontend/src/i18n/en.json`. The architecture supports adding new languages by:
1. Creating a new translation file (e.g., `es.json`)
2. Importing it in `frontend/src/i18n/index.ts`

Currently supported: **English**. Prepared for: Spanish, French, German, Portuguese, Hindi.

---

## Running Tests

```bash
# Backend tests
pytest tests/ -v --tb=short

# Frontend type check
cd frontend && npx tsc -b --noEmit

# Frontend build
cd frontend && npm run build
```

---

## License

MIT