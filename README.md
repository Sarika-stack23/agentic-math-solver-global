# 🧮 Global AI Math Tutor

**AI-powered math tutoring for students worldwide.** Solve problems, get verified step-by-step solutions, check your work, and practice with personalized exercises.

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Solve & Verify** | Multi-agent pipeline: Planner → Solver → Verifier → Formatter. Every solution is checked deterministically using `sympy` where applicable. |
| **Check My Work** | Submit your own solution — the tutor finds your first mistake and explains why. |
| **Hint Mode** | Progressive hints: conceptual direction → formula → next step. |
| **Teach Me** | Socratic guided learning — the tutor explains concepts rather than just giving the answer. |
| **Why?** | Tap "Why?" on any step to get a plain-English explanation. |
| **Practice** | Generate similar problems globally categorized by mathematical concept. |
| **Image Input** | Upload a photo or scan handwritten math — AI extracts and solves. |
| **PDF Upload** | Upload a textbook PDF, then ask questions about it using RAG. |

---

## 🔒 BYOK Architecture (Bring Your Own Key) & Server Load

This application runs on a completely **Free-Tier Architecture**. The FastAPI backend web server was load tested (using mocked AI responses) and is structurally capable of handling **1,000+ concurrent connections** locally (up to 1,885 req/s).

However, because the server relies on free global AI quotas (Groq/Gemini), heavy traffic will rapidly cause external AI rate limits (429 Quota Exhausted) to trip.

To bypass these strict server-side quota walls, this app uses a **BYOK (Bring Your Own Key) Architecture**:
1. Users can navigate to the **Settings Panel** and securely input their personal Gemini API key.
2. The key is stored **exclusively in the browser's `localStorage`**. It is NEVER sent to our database and NEVER logged.
3. The frontend securely attaches the key to the `X-Gemini-API-Key` header on every request, allowing the user to bypass the server's exhausted limits and utilize their own personal quotas, subject to the provider's limits.

---

## Tech Stack & Zero-Cost Breakdown

| Layer | Technology | Cost / Free Tier Limits |
|-------|-----------|------|
| **Frontend** | React 19, Vite, KaTeX | **$0**. Hosted via Vercel/Netlify. |
| **Backend** | FastAPI, Python 3.11, `asyncio` | **$0**. Scalable to 1,000+ users/sec. |
| **Primary LLM** | Google Gemini (AI Studio) | **$0**. 15 requests per minute limit. |
| **Fallback LLM** | Groq (Llama 3) | **$0**. 30-100 requests per minute limit. |
| **Vector DB** | Qdrant (in-memory) | **$0**. Completely local and volatile. |
| **Auth & DB** | Firebase Auth / Firestore | **$0**. Generous 50K MAU free tier. |

**Important**: There are absolutely no credit cards required, and no hidden billing loops.

---

## Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/Sarika-stack23/agentic-math-solver-global.git
cd agentic-math-solver-global
```

### 2. Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY (Server default fallback)

# Run the backend
uvicorn backend.src.main:app --host 0.0.0.0 --port 8080 --reload
```

### 3. Frontend

```bash
cd frontend
npm install --legacy-peer-deps
echo "VITE_API_URL=http://localhost:8080" > .env
npm run dev
```

Visit `http://localhost:5173` — the app is ready.

---

## Known Limitations

- **Volatile Storage**: Document uploads and memory use in-memory SQLite/Qdrant. Restarting the server clears active document indexes.
- **Quota Walls**: If users do not provide a BYOK API key in settings, they may experience frequent "Quota Exhausted" warnings when the global server keys run out of tokens. The app degrades gracefully and does not crash when this happens.
