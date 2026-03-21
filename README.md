# AgentQED — AI-Powered Mathematical Proof Verification

> Write a proof in plain English, speak it aloud, or photograph handwritten math. AgentQED translates it to Lean 4 and formally verifies it using the Lean compiler in an isolated sandbox.

**Live:** [proof-agent.vercel.app](https://proof-agent.vercel.app)
**Repo:** [github.com/gsankar967/AgentQED](https://github.com/gsankar967/AgentQED)

Built at the [Zero to Agent Hackathon](https://cerebralvalley.ai) (Vercel x Deepmind) — March 21, 2026, Shack15, SF.

---

## What It Does

AgentQED is a self-correcting AI agent that bridges informal mathematical reasoning and formal verification:

1. **You describe a proof** — type it, speak it, photograph handwritten math, or upload a PDF
2. **Gemini 3.1 Pro** reads your input, translates it into Lean 4 code
3. **Vercel Sandbox** spins up an isolated Firecracker microVM, installs Lean 4, and compiles the proof
4. **If verification fails**, the agent reads the compiler errors, fixes the code, and retries (up to 12 attempts)
5. **Once verified**, you get a structured result: Key Insight first, Proof Structure tree, then collapsible details

```
User: "Prove that for all natural numbers n, 0 + n = n"
  |
  v
Gemini 3.1 Pro translates to Lean 4:
  theorem zero_add (n : Nat) : 0 + n = n := by
    induction n with
    | zero => rfl
    | succ n ih => simp [Nat.add_succ, ih]
  |
  v
Vercel Sandbox runs `lean Proof.lean`
  |
  v
Proof verified by Lean 4 compiler
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-modal input** | Text, voice (microphone), images (handwritten proofs), PDFs, multiple files |
| **Voice input** | Click the mic button and speak your proof — real-time transcription via Web Speech API |
| **Formal verification** | Real Lean 4 compiler in Vercel Sandbox — not LLM judgment, compiler-verified correctness |
| **Self-correcting agent** | Reads compiler errors, fixes code, retries automatically (up to 12 attempts) |
| **Progressive disclosure** | Key Insight and Proof Structure shown first; code and details collapsed by default |
| **Key Insight highlight** | The "aha moment" of the proof is prominently displayed in a highlighted box |
| **Proof Structure tree** | Visual tree showing the logical skeleton (e.g., induction base + step) |
| **Collapsible sections** | Lean code, step breakdown, math insight, Lean insight — expand on demand |
| **LaTeX rendering** | KaTeX-powered math notation ($\sum$, $\forall$, $\implies$) throughout |
| **Lean doc links** | Inline code references (e.g., `simp`, `Nat.add_comm`) link to Mathlib documentation |
| **Session history** | Sidebar with saved sessions (localStorage for persistence, sessionStorage per tab) |
| **Mandelbrot background** | Canvas-rendered fractal in dark violet tones with vignette overlay |
| **Sentry monitoring** | Error tracking and performance monitoring |
| **6 example proofs** | Pre-built examples: modus ponens, induction, commutativity, list reversal, etc. |

---

## Architecture

### System Overview

```
+--------+---------------------------------------------+
|        |  Header (56px)                               |
|Sidebar |  Progress Bar (during verification)          |
|(260px) |  +-------------------------------------------+
|history |  |                                           |
|sessions|  |  Proof Result Card                        |
|        |  |  +---------------------------------------+|
|        |  |  | VERIFIED                               ||
|        |  |  | Statement: "..."                       ||
|        |  |  | Key Insight [highlighted box]          ||
|        |  |  | Proof Structure [tree view]            ||
|        |  |  | [> Lean 4 Code] (collapsed)            ||
|        |  |  | [> Step Breakdown] (collapsed)         ||
|        |  |  | [> Math Insight] (collapsed)           ||
|        |  |  | [> Lean Insight] (collapsed)           ||
|        |  |  +---------------------------------------+|
|        |  |                                           |
|        |  +-------------------------------------------+
|        |  Input: [upload] [mic] [text input] [send]   |
+--------+---------------------------------------------+
```

### Data Flow

```
User Input (text / voice / image / PDF)
  |
  v
Next.js API Route (/api/chat)
  |-- Convert UIMessages to ModelMessages (handle data URLs)
  |
  v
Gemini 3.1 Pro Preview (via AI SDK v6)
  |-- streamText() with system prompt
  |-- Agent loop: stopWhen(stepCountIs(12))
  |
  v
verifyLean Tool Call
  |-- Vercel Sandbox: create microVM
  |-- Install Lean 4 via elan (cached 5 min)
  |-- Write Proof.lean + run compiler
  |-- Return { verified, output, errors }
  |
  v
If error: Gemini reads errors, fixes code, retries
If success: Stream structured response
  |
  v
Frontend renders ProofResultCard
  |-- Key Insight (highlighted, always visible)
  |-- Proof Structure (tree, always visible)
  |-- Lean Code (collapsed)
  |-- Step Breakdown (collapsed)
  |-- Math/Lean Insights (collapsed)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 + React 19 | Full-stack app |
| AI Model | Gemini 3.1 Pro Preview | Translation, vision, multi-step reasoning |
| AI SDK | Vercel AI SDK v6 | Streaming, tool calling, agent loop |
| Sandbox | Vercel Sandbox (Firecracker) | Isolated Lean 4 compilation |
| Proof Engine | Lean 4 v4.16.0 (via elan) | Formal mathematical verification |
| Voice | Web Speech API | Browser-native speech-to-text |
| Math | KaTeX + remark-math + rehype-katex | LaTeX rendering |
| Markdown | react-markdown | Proof explanations |
| Styling | Tailwind CSS v4 | Dark theme with design tokens |
| Background | Canvas (Mandelbrot fractal) | Mathematical aesthetic |
| Icons | Lucide React | UI icons |
| Persistence | localStorage + sessionStorage | Session history |
| Monitoring | Sentry | Error tracking |
| Deployment | Vercel (Fluid Compute, 300s) | Serverless |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, Geist fonts
│   ├── page.tsx                # Renders <Chat />
│   ├── globals.css             # Design tokens, proof-prose styles,
│   │                           # collapsible sections, animations,
│   │                           # Lean doc link styles, KaTeX overrides
│   ├── global-error.tsx        # Sentry error boundary
│   └── api/
│       └── chat/
│           └── route.ts        # Agent endpoint:
│                               #   - convertUIMessagesToModel() for images/PDFs
│                               #   - verifyLean tool with Zod schema
│                               #   - System prompt with structured output format
│                               #   - Lean 4 tactic guidelines
├── components/
│   ├── chat.tsx                # Main UI (~680 lines):
│   │                           #   - ProofResultCard (progressive disclosure)
│   │                           #   - ProgressBar (Vercel-style pipeline)
│   │                           #   - ToolCard (running/success/fail states)
│   │                           #   - Voice input (Web Speech API)
│   │                           #   - Session sidebar (slide animation)
│   │                           #   - Collapsible sections with icons
│   │                           #   - Lean identifier → Mathlib doc links
│   │                           #   - Multi-file upload (images + PDFs)
│   │                           #   - 6 example proof buttons
│   └── math-background.tsx     # Mandelbrot fractal canvas renderer
├── instrumentation.ts          # Sentry server instrumentation
├── instrumentation-client.ts   # Sentry client instrumentation
└── lib/
    ├── lean-runner.ts          # Vercel Sandbox lifecycle:
    │                           #   - Singleton sandbox (5-min TTL)
    │                           #   - elan installer from GitHub
    │                           #   - writeFiles() + runCommand()
    └── session-store.ts        # Browser storage:
                                #   - localStorage CRUD for sessions
                                #   - sessionStorage for active session
                                #   - Auto title extraction
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- [Vercel](https://vercel.com) account with Sandbox access (Pro plan)

### Installation

```bash
git clone https://github.com/gsankar967/AgentQED.git
cd AgentQED

npm install

# Link to Vercel for Sandbox access
npx vercel link
npx vercel env pull

# Add Gemini API key
echo 'GOOGLE_GENERATIVE_AI_API_KEY=your-key' >> .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | From [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `VERCEL_OIDC_TOKEN` | Auto | Generated by `vercel env pull` for Sandbox auth |
| `SENTRY_AUTH_TOKEN` | No | For source map uploads |

### Deploy

```bash
npx vercel env add GOOGLE_GENERATIVE_AI_API_KEY
npx vercel --prod
```

---

## How It Works

### The Agent Loop

The AI SDK's multi-step agent loop (`stopWhen: stepCountIs(12)`) with one tool:

**`verifyLean`** — Takes Lean 4 code, executes it in a Vercel Sandbox, returns pass/fail with compiler output.

1. Gemini generates Lean 4 code from your proof
2. Calls `verifyLean` tool
3. Sandbox writes code + runs Lean compiler
4. If compiler succeeds → Gemini explains with structured output
5. If compiler fails → Gemini reads error, fixes code, retries
6. Repeats until success or 12 steps reached

### Progressive Disclosure UI

The response is structured for understanding, not information dumping:

| Priority | Section | Default State |
|----------|---------|---------------|
| 1 | **Key Insight** | Always visible, highlighted box |
| 2 | **Proof Structure** | Always visible, tree format |
| 3 | Lean 4 Code | Collapsed |
| 4 | Step-by-Step Breakdown | Collapsed |
| 5 | Mathematical Insight | Collapsed |
| 6 | Lean Formalization Details | Collapsed |

This shifts the UX from "display everything" to "guide understanding."

### Voice Input

Click the microphone button to dictate proofs using the Web Speech API:
- Real-time transcription appears in the input field
- Red pulsing indicator while listening
- Click again or press Enter to stop and send
- Works in Chrome, Edge, and Safari

### Multi-Modal Input

Gemini 3.1 Pro's vision enables:
- **Images**: Photos of handwritten proofs on paper/whiteboard
- **PDFs**: Multi-page mathematical documents
- **Multiple files**: Upload several at once
- Files are base64-encoded and sent as file parts

---

## Example Proofs

| Proof | Domain | Key Tactics |
|-------|--------|-------------|
| Modus Ponens | Propositional Logic | `apply`, `exact` |
| 0 + n = n | Natural Numbers | `induction`, `simp` |
| A and B implies B and A | Logic | `constructor`, `exact` |
| Double Negation | Decidable Props | `intro`, `decide` |
| List Reverse Reverse | Data Structures | `induction`, `simp` |
| Sum of First n Naturals | Number Theory | `induction`, `omega`, `calc` |

---

## Known Limitations

1. **No Mathlib** — Only Lean 4's core library. Advanced algebra/topology proofs need Mathlib.
2. **Cold start** — First request: ~30-60s to install Lean. Subsequent: instant (5-min cache).
3. **Nonlinear arithmetic** — `omega` only handles linear. Agent uses `ring` or `calc` chains for polynomial goals.
4. **Voice input** — Web Speech API requires Chrome/Edge/Safari. Not available in Firefox.

---

## Cost

| Metric | Value |
|--------|-------|
| Cost per proof | ~$0.05 - $0.15 |
| Hackathon total | ~$3.50 estimated |

---

## License

MIT
