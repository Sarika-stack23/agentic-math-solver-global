# Cost Audit — AI Math Tutor

**Audit Date:** August 2026  
**Result: $0/month — All services on free tiers.**

---

## Service Breakdown

| Service | Purpose | Free Tier Limits | Paid Tier Risk | Alternative |
|---------|---------|-----------------|----------------|-------------|
| **Google Gemini (AI Studio)** | Primary LLM (text + vision) | 15 RPM / 1M tokens/day | Rate limits on heavy use → auto-fallback to Groq | Groq (free), Ollama (local) |
| **Groq Cloud** | Fallback LLM | 30 RPM / 6K tokens/min | Rate limits only | Ollama (local, free) |
| **Firebase Auth** | User authentication | 50,000 MAU | None at current scale | Supabase Auth (free tier) |
| **Firebase Firestore** | Progress, history, mistakes | 1 GB storage, 50K reads/day | Low risk | SQLite (local, free) |
| **Qdrant** | Vector DB for RAG | In-memory (unlimited local) | None | ChromaDB (free, open source) |
| **SymPy / NumPy / SciPy** | Math computation | Open source (unlimited) | None | N/A |
| **Vercel** | Frontend hosting | 100 GB bandwidth/mo | None at current scale | Cloudflare Pages (free) |
| **HuggingFace Spaces** | Backend hosting | Free Docker containers | Memory limits on free tier | Railway.app (free tier) |
| **GitHub Actions** | CI/CD | 2,000 min/mo (free) | None | N/A |

---

## Risk Assessment

### Low Risk
- **Firebase Auth**: 50K MAU is generous. No cost until massive scale.
- **Vercel**: 100 GB bandwidth handles thousands of users.
- **SymPy/NumPy**: Open source, no API costs.
- **Qdrant in-memory**: No external service dependency.

### Medium Risk (Rate Limits)
- **Gemini API**: 15 RPM per key on free tier. Mitigated by:
  1. Automatic fallback to Groq
  2. Users can provide their own API key
  3. Client-side rate limit awareness
- **Groq API**: 30 RPM. Mitigated by being a fallback only.

### No Risk
- GitHub, Vercel, and HuggingFace are all within free-tier boundaries.
- No paid APIs, no credit card required for any service.

---

## External Service Checklist

- [x] No paid services in use
- [x] Every external dependency has a free tier or open-source alternative
- [x] API keys are user-configurable (Settings page)
- [x] Rate limit fallback chain: Gemini → Groq → Gemini Flash Lite
- [x] Firebase is optional (USE_FIREBASE=false works)
- [x] Vector DB is in-memory (no external Qdrant cluster needed)
