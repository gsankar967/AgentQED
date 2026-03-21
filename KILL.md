# AgentQED - Kill File

## Zero to Agent Hackathon | March 21, 2026 | Shack15, SF

**Team:** Sankar
**Problem Statement:** Statement 3 (AI Application) + Statement 2 (Multi-Modal Agent)
**Submission Deadline:** 5:00 PM
**Live URL:** https://agent-qed.vercel.app

---

## What It Does

AgentQED is an AI agent that takes a human-written mathematical proof (natural language, LaTeX, images of handwritten math, or PDF documents), translates it into Lean 4 formal proof code, and verifies correctness by running the Lean 4 compiler in a Vercel Sandbox. When verification fails, the agent reads compiler errors, fixes the proof, and retries — up to 12 iterations.

### Core Flow
```
User writes proof in English/LaTeX/image/PDF
  → Gemini 3.1 Pro reads & translates to Lean 4
  → Vercel Sandbox runs `lean` compiler
  → If error: Gemini reads error, fixes, re-runs (up to 12 attempts)
  → Verified proof + step-by-step explanation
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-modal input** | Plain text, LaTeX, images (handwritten proofs), PDFs, multiple files |
| **Formal verification** | Lean 4 compiler runs in Vercel Sandbox — real compiler, not LLM judgment |
| **Self-correcting agent** | Reads Lean compiler errors, fixes code, retries automatically |
| **Progress tracker** | 4-step visual progress bar: Reading → Translating → Compiling → Verified |
| **Session history** | Sidebar with saved sessions (localStorage for long-term, sessionStorage for active tab) |
| **New chat** | `+` button in header or sidebar to start fresh proof sessions |
| **Voice input** | Speak your proof via microphone — real-time transcription via Web Speech API |
| **Progressive disclosure** | Key Insight + Proof Structure shown first; code/details collapsed by default |
| **Key Insight highlight** | The "aha moment" prominently displayed in a highlighted box |
| **Proof Structure tree** | Visual tree showing logical skeleton of the proof |
| **Collapsible sections** | Lean code, step breakdown, insights — expand on demand |
| **Mandelbrot background** | Canvas-rendered fractal with vignette overlay |
| **Example proofs** | 6 pre-built proof examples for quick demo |
| **Real-time status** | Header badge shows Verified / Not Verified / Working |

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | Next.js 16 (App Router) | Full-stack React |
| AI Model | Gemini 3.1 Pro Preview (via AI SDK) | Proof translation, vision, error correction |
| AI SDK | Vercel AI SDK v6 | Streaming, tool calling, multi-step agent loop |
| Sandbox | Vercel Sandbox (@vercel/sandbox) | Isolated Lean 4 execution in Firecracker microVMs |
| Proof Engine | Lean 4 v4.16.0 (via elan) | Formal mathematical verification |
| Voice | Web Speech API | Browser-native speech-to-text for proof dictation |
| Math Rendering | KaTeX + remark-math + rehype-katex | LaTeX in all responses |
| UI | Tailwind CSS v4 + Lucide icons | Dark theme with design tokens |
| Persistence | localStorage + sessionStorage | Session history (long-term + short-term) |
| Monitoring | Sentry | Error tracking + performance |
| Deployment | Vercel (Fluid Compute, 300s timeout) | Serverless deployment |

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx              # Root layout with fonts, metadata
│   ├── page.tsx                # Main page → renders Chat component
│   ├── globals.css             # Global styles (dark theme, scrollbar, prose)
│   └── api/
│       └── chat/
│           └── route.ts        # Agent endpoint: UIMessage → Gemini → Sandbox → stream
├── components/
│   └── chat.tsx                # Full chat UI: sidebar, progress, messages, file upload
└── lib/
    ├── lean-runner.ts          # Vercel Sandbox lifecycle + Lean 4 execution
    └── session-store.ts        # localStorage/sessionStorage session management
```

### Key Files

**`src/app/api/chat/route.ts`** — The agent brain
- Uses `streamText()` with Gemini 3.1 Pro Preview
- Custom `convertUIMessagesToModel()` handles data URLs for images/PDFs
- Defines `verifyLean` tool with Zod schema
- Agent loop: `stopWhen: stepCountIs(12)` — up to 12 translate/verify cycles
- System prompt has detailed Lean 4 guidelines (tactics, syntax, no Mathlib)
- Handles multi-modal messages (text + image + PDF in same request)

**`src/lib/lean-runner.ts`** — The verification engine
- Creates a Vercel Sandbox (Firecracker microVM, default Node.js 24 runtime)
- Downloads elan installer from GitHub, installs Lean 4 v4.16.0
- Persists sandbox across requests (5-minute timeout, reused for subsequent proofs)
- Writes `.lean` files via `writeFiles()` and runs compiler via `runCommand()`
- Returns structured result: `{ success, output, errors, leanCode }`

**`src/lib/session-store.ts`** — Session persistence
- `localStorage` for long-term storage (survives browser close)
- `sessionStorage` for active session ID (per-tab continuity)
- CRUD operations: list, get, save, delete sessions
- Auto-extracts title from first user message

**`src/components/chat.tsx`** — The user interface
- Chat interface with `useChat()` hook (AI SDK v6, per-session `id`)
- Collapsible sidebar with session history (timestamps, delete, load)
- `+` button in header for new chat; panel icon to toggle sidebar
- Progress tracker: 4-step bar with animated active step and retry counter
- Multi-file upload (images + PDFs) with preview thumbnails
- Tool invocation cards: amber (running), green (verified), red (failed)
- Auto-scroll, auto-resize textarea, keyboard shortcuts (Enter to send)

---

## Environment Variables

```bash
# Required — get from Google AI Studio or hackathon temp account
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key

# Auto-provided by Vercel when project is linked
VERCEL_OIDC_TOKEN=auto-generated
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Link to Vercel (required for Sandbox access)
npx vercel link
npx vercel env pull

# Add Gemini API key to .env.local
echo 'GOOGLE_GENERATIVE_AI_API_KEY=your-key' >> .env.local

# Start dev server
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel

```bash
# Set environment variable
npx vercel env add GOOGLE_GENERATIVE_AI_API_KEY

# Deploy to production
npx vercel --prod
```

---

## Judging Alignment

### Live Demo (45%)
- **3-minute demo script:**
  1. Show landing page with example proofs + explain the concept (20 sec)
  2. Click "Modus ponens" — watch progress bar, agent translate, verify in sandbox (40 sec)
  3. Type a custom proof: "Prove 0 + n = n by induction" — full loop with progress (40 sec)
  4. Show a failing proof: "Prove 1 = 2" — agent explains why it's false (30 sec)
  5. Upload photo of handwritten proof — Gemini vision reads it, translates, verifies (30 sec)
  6. Open sidebar, show session history persisted across refreshes (10 sec)
  7. Highlight tech stack: Gemini 3.1 Pro + Lean 4 + Vercel Sandbox (10 sec)

### Creativity & Originality (35%)
- **Novel combination:** LLM + formal proof assistant — rarely done in hackathons
- **Real compiler verification:** Not "LLM says it's correct" — actual Lean 4 compiler in sandbox
- **Self-correcting agent:** Reads compiler errors and iteratively fixes its own code
- **Multi-modal:** Handwritten math photos → formal verification (vision + code gen + compilation)
- **Bridges informal→formal math:** Major gap in math education and research

### Impact Potential (20%)
- **Math education:** Students can verify their proofs instantly
- **Research tool:** Mathematicians can formalize intuitive arguments
- **AI safety:** Verified reasoning chains, not just LLM hallucination
- **Lean ecosystem:** Lowers barrier to entry for formal verification
- **Accessibility:** Handwritten proof photos make it usable without typing formal notation

---

## Hackathon Rules Checklist

- [x] Repository is public
- [x] Team size <= 4 (solo)
- [x] New work only (built during event)
- [x] Not on banned list (not RAG, not Streamlit, not medical/mental health)
- [ ] 1-minute demo video for submission
- [ ] Submission form at cerebralvalley.ai

---

## Known Limitations / Risks

1. **Lean installation time:** First request takes ~30-60 seconds to install elan + Lean in sandbox. Subsequent requests reuse the sandbox (instant).
2. **No Mathlib:** Only Lean 4's core library. Advanced proofs requiring Mathlib will fail.
3. **Sandbox timeout:** Sandbox lives for 5 minutes. If idle, next request re-creates it.
4. **Model hallucination:** Gemini may generate invalid Lean syntax, but the verify→retry loop handles this (up to 12 attempts).
5. **Vercel Sandbox access:** Requires a Vercel account with sandbox enabled (Pro plan).
6. **Large images:** Very high-res photos may be slow to upload as data URLs.

---

## Potential Extensions

- [ ] Sandbox snapshotting (pre-install Lean, instant cold start)
- [ ] LaTeX rendering in the UI (KaTeX)
- [ ] Side-by-side natural language <-> Lean view
- [ ] Export verified proofs as `.lean` files
- [ ] Mathlib support via cached Lake project
- [ ] Proof gallery / sharing
