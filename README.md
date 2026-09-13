# Σ Agentic Math Solver (Global)

> An enterprise-grade, AI-powered mathematics learning workspace featuring autonomous agentic reasoning, deterministic symbolic verification, and structured pedagogical modes.

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agent_Orchestration-orange)](https://langchain-ai.github.io/langgraph/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%7C_Firestore-FFCA28?logo=firebase)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

---

## What Is This?

Agentic Math Solver is a **next-generation digital mathematics learning platform**. Unlike generic LLM chatbots that frequently hallucinate arithmetic or skip logical steps, this platform combines the generative capabilities of LLMs with **deterministic mathematical engines** (SymPy) and **autonomous agent orchestration** (LangGraph).

It is designed for students, educators, and institutions that require mathematically verified, step-by-step solutions accompanied by rigorous pedagogical structures.

---

## 🏗 System Architecture

The application follows a decoupled client-server architecture, utilizing a multi-agent backend graph for complex reasoning tasks.

```mermaid
flowchart TB
    subgraph Frontend [Client Layer]
        UI["React + TS + Vite UI"]
        AuthContext["Firebase Auth Context"]
    end

    subgraph Backend [API Layer (FastAPI)]
        Router["API Routers"]
        Middleware["Auth Middleware (JWT Verify)"]
        State["PostgreSQL / Firestore (State/Progress)"]
    end

    subgraph Orchestration [LangGraph Agent Orchestrator]
        Planner["🤖 Planner Node"]
        Solver["⚙️ Solver Node"]
        Verifier["✅ Verifier Node (SymPy)"]
        Formatter["📝 Formatter Node (LaTeX)"]
    end

    subgraph Services [External Services]
        Groq["Groq (openai/gpt-oss-120b)"]
        Gemini["Google Gemini (Vision)"]
        Qdrant["Qdrant (Vector DB)"]
    end

    UI -->|"REST (Bearer JWT)"| Middleware
    Middleware --> Router
    Router -->|"User Query"| Planner

    Planner --> Solver
    Solver --> Verifier
    Verifier --> Solver
    Verifier --> Formatter
    Formatter --> Router

    Solver -->|"Tool Calls"| Groq
    Solver -->|"RAG Queries"| Qdrant
    Router -->|"Multimodal Input"| Gemini
```

---

## ✨ Key Capabilities

### 1. Multi-Agent Reasoning Engine
- **Planner**: Deconstructs complex math problems into logical, executable steps.
- **Solver**: Executes mathematical operations using integrated tools (Calculators, SymPy).
- **Verifier**: Deterministically checks the LLM's derivations to prevent hallucination.
- **Formatter**: Transforms raw mathematical output into beautiful, strict LaTeX for the frontend.

### 2. Pedagogical Action Modes
Every solved problem offers targeted follow-up actions designed around modern learning theory:
- **Solve**: Full step-by-step verified derivation.
- **Hint**: Provides a targeted hint to help students unstuck themselves.
- **Steps**: Provides a roadmap of the solution without giving the full derivation.
- **Answer**: Gives the final answer with a brief useful explanation.
- **Check My Work**: Analyzes a student's attempt, pinpoints the *exact* step where the error occurred, and explains the correction without just giving the answer.
- **Teach Me**: Explains the underlying mathematical concept with formulas and examples.
- **Another Method**: Provides a genuinely different complete method to solve the problem.
- **Similar Problem**: Creates a new similar problem to test understanding.
- **Practice**: Creates a new practice problem for the student to solve.
- **Ask AI**: Allows contextual follow-up questions about the problem.

### 3. Multi-Modal Processing
- **Vision (OCR)**: Upload handwritten math equations or textbook snippets for instant parsing via Gemini Vision.
- **Document Indexing (PDF)**: Upload entire worksheets or textbook chapters. The system indexes them into a Qdrant Vector DB for semantic RAG querying.

### 4. Progress & Analytics
- **Firebase Authentication**: Secure Google OAuth and Email/Password login.
- **Streak Tracking**: Firestore-backed user profiles tracking daily activity maps, total problems solved, and accuracy metrics.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+
- Firebase Project (for Auth/Firestore)
- API Keys: Groq (Primary Inference), Google AI Studio (Vision)

### 1. Clone & Environment Setup
```bash
git clone https://github.com/your-org/agentic-math-solver-global.git
cd agentic-math-solver-global
```

**Backend `.env`:**
```env
# backend/.env
USE_FIREBASE=true
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CREDENTIALS_PATH="./backend/firebase-adminsdk.json" # Required for DB
GROQ_API_KEY="your-groq-key"
GEMINI_API_KEY="your-gemini-key"
```

**Frontend `.env`:**
```env
# frontend/.env
VITE_API_URL=http://localhost:8080
VITE_FIREBASE_API_KEY="xxx"
VITE_FIREBASE_AUTH_DOMAIN="xxx"
VITE_FIREBASE_PROJECT_ID="xxx"
```

### 2. Start Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.src.main:app --host 0.0.0.0 --port 8080 --reload
```

### 3. Start Frontend (React/Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## 🔒 Security & Deployment

- **Authentication**: JWTs are issued by Firebase on the client and verified securely via the Firebase Admin SDK on the FastAPI backend.
- **Token Verification**: Local development allows token verification via `FIREBASE_PROJECT_ID` without requiring a raw service account JSON, preventing credential leaks.
- **Historical Firebase credential exposure**:
  The credential file has been removed from the current tree and ignored. The historically exposed service-account key (commit 8a8382a) has been successfully verified as revoked in the Google Cloud Console.
- **Deployment**:
  - Frontend is optimized for Vercel or Firebase Hosting.
  - Backend is containerized via Docker for deployment to Google Cloud Run, Render, or AWS AppRunner.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
