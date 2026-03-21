# AgentQED — AI-Powered Mathematical Proof Verification

> Write a proof in plain English, LaTeX, or upload a photo of handwritten math. AgentQED translates it to Lean 4 and formally verifies it using the Lean compiler in an isolated sandbox.

**Live:** [agent-qed.vercel.app](https://agent-qed.vercel.app)

Built at the [Zero to Agent Hackathon](https://cerebralvalley.ai) (Vercel x Deepmind) — March 21, 2026, Shack15, SF.

---

## What It Does

AgentQED is a self-correcting AI agent that bridges informal mathematical reasoning and formal verification:

1. **You describe a proof** in natural language, LaTeX, an image of handwritten math, or a PDF
2. **Gemini 3.1 Pro** reads your input, translates it into Lean 4 code
3. **Vercel Sandbox** spins up an isolated Firecracker microVM, installs Lean 4, and compiles the proof
4. **If verification fails**, the agent reads the compiler errors, fixes the code, and retries (up to 12 attempts)
5. **Once verified**, you get the Lean 4 code with step-by-step explanation, mathematical intuition, and Lean-specific insights

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
| **Multi-modal input** | Plain text, LaTeX, images (handwritten proofs), PDFs, multiple files at once |
| **Formal verification** | Real Lean 4 compiler in Vercel Sandbox — not LLM judgment |
| **Self-correcting agent** | Reads compiler errors, fixes code, retries automatically (up to 12 attempts) |
| **Progress tracker** | 4-step visual progress bar with cycling status messages and retry counter |
| **Insights panel** | Tabbed right panel: Mathematical Insight (pure math) vs Lean Insight (formalization) |
| **LaTeX rendering** | KaTeX-powered math notation in all explanations |
| **Lean doc links** | Inline code references link directly to Mathlib/Lean documentation |
| **Session history** | Sidebar with saved sessions (localStorage for long-term, sessionStorage per tab) |
| **Math background** | Subtle mathematical symbols and grid pattern with violet gradient glow |
| **Sentry monitoring** | Error tracking and performance monitoring via Sentry |
| **6 example proofs** | Pre-built examples for quick demo: modus ponens, induction, list reversal, etc. |

---

## Architecture

### System Overview

```
                         +----------------------------------------------+
                         |              AgentQED                         |
                         |         agent-qed.vercel.app                |
                         +----------------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                      |                      |
              +-----v-----+         +-----v-----+         +-----v-----+
              |  Next.js   |         |  API Route |         |  Vercel   |
              |  Frontend  |<------->|  /api/chat |-------->|  Sandbox  |
              |  (React)   |         |  (Agent)   |         |  (Lean 4) |
              +-----+------+         +-----------+         +-----------+
                    |
              +-----v-----+
              | Browser    |
              | Storage    |
              | (sessions) |
              +-----------+
```

### Detailed Component Architecture

```
+-----------------------------------------------------------------------------+
|                              USER INPUT                                      |
|                                                                              |
|   +--------------+  +--------------+  +--------------+  +--------------+    |
|   |  Plain Text  |  |    LaTeX     |  |  Image/Photo |  |     PDF      |    |
|   |  "Prove that |  |  \forall n   |  |  [handwritten|  |  [multi-page |    |
|   |   0+n = n"   |  |  \in \N ...  |  |   math]      |  |   proofs]    |    |
|   +------+-------+  +------+-------+  +------+-------+  +------+-------+    |
|          +------------------+-----------------+-----------------+            |
|                             |                                                |
+-----------------------------+------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------------------------+
|                         FRONTEND (Next.js 16)                                |
|                                                                              |
|   src/components/chat.tsx                                                    |
|   +-----------------------------------------------------------------------+  |
|   |                                                                       |  |
|   |  +---------------------------+  +---------------------------------+   |  |
|   |  |   SIDEBAR                 |  |   MAIN CHAT AREA                |   |  |
|   |  |                           |  |                                 |   |  |
|   |  |  [+] New Proof            |  |  HEADER                        |   |  |
|   |  |                           |  |  [=] AgentQED [+]              |   |  |
|   |  |  Session History:         |  |  Status: Verified/Failed/...   |   |  |
|   |  |  - Modus ponens     2:14  |  |                                 |   |  |
|   |  |  - 0+n=n proof      1:52  |  |  PROGRESS TRACKER               |   |  |
|   |  |  - Induction...     1:30  |  |  [1]--[2]--[3]--[4]             |   |  |
|   |  |                           |  |  Read  Trans Comp  Verif        |   |  |
|   |  |  Storage:                 |  |  "Running Lean 4 compiler..."   |   |  |
|   |  |  - localStorage (long)    |  |                                 |   |  |
|   |  |  - sessionStorage (tab)   |  |  MESSAGES          | INSIGHTS   |   |  |
|   |  |                           |  |  User: "Prove ..." | [Math|Lean]|   |  |
|   |  +---------------------------+  |  [Compiling...]    | Intuition  |   |  |
|   |                                  |  [Verified!]      | Why it     |   |  |
|   |                                  |  Assistant: code  | matters    |   |  |
|   |                                  |  + explanation    | Key ideas  |   |  |
|   |                                  |                    |            |   |  |
|   |                                  |  INPUT BAR                     |   |  |
|   |                                  |  [img] [textarea........] [->] |   |  |
|   |                                  +---------------------------------+   |  |
|   |                                                                       |  |
|   |  useChat() hook (AI SDK v6, per-session id)                           |  |
|   |  sendMessage({ text, files[] })                                       |  |
|   +-----------------------------------------------------------------------+  |
|                                                                              |
+-----------------------------------------------------------------------------+
                              |
                       POST /api/chat
                    (UIMessage[] stream)
                              |
                              v
+-----------------------------------------------------------------------------+
|                        API ROUTE (Serverless, 300s timeout)                   |
|                                                                              |
|   src/app/api/chat/route.ts                                                  |
|   +-----------------------------------------------------------------------+  |
|   |                                                                       |  |
|   |   1. Parse UIMessage[] from request body                              |  |
|   |   2. convertUIMessagesToModel() -- custom converter:                  |  |
|   |      - Text parts --> { type: "text", text }                          |  |
|   |      - File parts --> extract base64 from data URL                    |  |
|   |        --> { type: "file", data: base64, mediaType }                  |  |
|   |      - Tool results --> { type: "tool-result", output }               |  |
|   |   3. Call streamText() with Gemini 3.1 Pro Preview                    |  |
|   |                                                                       |  |
|   |   +---------------------------------------------------------------+   |  |
|   |   |              AGENT LOOP (stopWhen: stepCountIs(12))           |   |  |
|   |   |                                                               |   |  |
|   |   |   +--------------+     +--------------+                      |   |  |
|   |   |   |   Gemini      |---->|  verifyLean  |                      |   |  |
|   |   |   |   3.1 Pro     |<----|  tool call   |                      |   |  |
|   |   |   |   Preview     |     |              |                      |   |  |
|   |   |   |              |     |  Zod schema:  |                      |   |  |
|   |   |   |  - Read image|     |  { code: z.   |                      |   |  |
|   |   |   |  - Read PDF  |     |    string() } |                      |   |  |
|   |   |   |  - Translate |     |              |                      |   |  |
|   |   |   |  - Fix errors|     |  Returns:    |                      |   |  |
|   |   |   |  - Explain   |     |  { verified, |                      |   |  |
|   |   |   |              |     |    output,   |                      |   |  |
|   |   |   |              |     |    errors,   |                      |   |  |
|   |   |   |              |     |    code }    |                      |   |  |
|   |   |   +--------------+     +------+-------+                      |   |  |
|   |   |                               |                               |   |  |
|   |   |         If error: retry <-----+                               |   |  |
|   |   |         If success: explain + return                          |   |  |
|   |   +---------------------------------------------------------------+   |  |
|   |                                                                       |  |
|   |   4. Stream response via toUIMessageStreamResponse()                  |  |
|   +-----------------------------------------------------------------------+  |
|                                                                              |
+-----------------------------------------------------------------------------+
                              |
                       Sandbox API call
                              |
                              v
+-----------------------------------------------------------------------------+
|                     VERCEL SANDBOX (Firecracker microVM)                      |
|                                                                              |
|   src/lib/lean-runner.ts                                                     |
|   +-----------------------------------------------------------------------+  |
|   |                                                                       |  |
|   |   Sandbox Lifecycle:                                                  |  |
|   |   +----------+    +--------------+    +------------------------+     |  |
|   |   | Create   |--->| Download     |--->| Install Lean 4 v4.16.0 |     |  |
|   |   | Sandbox  |    | elan-init.sh |    | (cached for 5 min)     |     |  |
|   |   | (node24) |    | (from GitHub)|    | via elan toolchain mgr |     |  |
|   |   +----------+    +--------------+    +------------------------+     |  |
|   |                                                                       |  |
|   |   Per-Proof Execution:                                                |  |
|   |   +--------------+    +--------------+    +--------------------+     |  |
|   |   | writeFiles() |--->| runCommand() |--->| Parse exit code    |     |  |
|   |   | Proof.lean   |    | $HOME/.elan/ |    | + stdout/stderr    |     |  |
|   |   | to sandbox   |    | bin/lean ... |    | for errors/success |     |  |
|   |   +--------------+    +--------------+    +--------------------+     |  |
|   |                                                                       |  |
|   |   Returns: { success, output, errors, leanCode }                     |  |
|   +-----------------------------------------------------------------------+  |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Data Flow: Proof Verification Cycle

```
 User                    Frontend              API Route             Gemini              Sandbox
  |                        |                      |                    |                    |
  |  1. Enter proof        |                      |                    |                    |
  |  (text/image/PDF)      |                      |                    |                    |
  |----------------------->|                      |                    |                    |
  |                        |  2. Save to           |                    |                    |
  |                        |  sessionStorage       |                    |                    |
  |  [Progress: Reading]   |  3. POST /api/chat   |                    |                    |
  |<-----------------------|  UIMessage[]          |                    |                    |
  |                        |--------------------->|                    |                    |
  |                        |                      |  4. Convert msgs   |                    |
  |                        |                      |  (data URLs ->     |                    |
  |                        |                      |   base64 files)    |                    |
  |                        |                      |  5. streamText()   |                    |
  |  [Progress: Translating]                      |  with system prompt|                    |
  |<-----------------------|                      |------------------->|                    |
  |                        |                      |  6. Tool call:     |                    |
  |                        |                      |  verifyLean(code)  |                    |
  |                        |                      |<-------------------|                    |
  |  [Progress: Compiling] |                      |  7. Create sandbox |                    |
  |<-----------------------|                      |  + install Lean    |                    |
  |                        |                      |------------------------------------------->|
  |                        |                      |  8. Write + compile                        |
  |                        |                      |------------------------------------------->|
  |                        |                      |  9. Return result                          |
  |                        |                      |<-------------------------------------------|
  |                        |                      |  10. Tool result   |                    |
  |                        |                      |  back to Gemini    |                    |
  |                        |                      |------------------->|                    |
  |                        |                      |     +--------------+                    |
  |  [Progress: Attempt 2] |                      |     | If error:    |                    |
  |<-----------------------|                      |     | Fix + retry  |                    |
  |                        |                      |     +--------------+                    |
  |  [Progress: Verified!] |                      |  11. Final response|                    |
  |<-----------------------|                      |<-------------------|                    |
  |                        |  12. Stream chunks   |                    |                    |
  |                        |<---------------------|                    |                    |
  |                        |  13. Save session    |                    |                    |
  |                        |  to localStorage     |                    |                    |
  |  14. See verified      |                      |                    |                    |
  |  proof + explanation   |                      |                    |                    |
  |<-----------------------|                      |                    |                    |
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 + React 19 | Full-stack app framework |
| AI Model | Gemini 3.1 Pro Preview | Proof translation, vision (images/PDFs), multi-step reasoning |
| AI SDK | Vercel AI SDK v6 | Streaming, tool calling, multi-step agent loop (`stopWhen`) |
| Sandbox | Vercel Sandbox (Firecracker) | Isolated Lean 4 execution in microVMs |
| Proof Engine | Lean 4 v4.16.0 (via elan) | Formal mathematical verification |
| Styling | Tailwind CSS v4 | Dark theme UI with math background |
| Math Rendering | KaTeX + remark-math + rehype-katex | LaTeX math notation in responses |
| Markdown | react-markdown | Render proof explanations |
| Icons | Lucide React | UI icons |
| Persistence | localStorage + sessionStorage | Chat session history |
| Monitoring | Sentry | Error tracking + performance monitoring |
| Deployment | Vercel (Fluid Compute, 300s) | Serverless deployment |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, Geist fonts, metadata
│   ├── page.tsx                # Renders <Chat /> component
│   ├── globals.css             # Dark theme, math background, KaTeX overrides,
│   │                           # Lean doc link styles, scrollbar, prose styles
│   ├── global-error.tsx        # Sentry error boundary
│   └── api/
│       └── chat/
│           └── route.ts        # POST handler: UIMessage[] -> Gemini -> Sandbox -> stream
│                               #   - convertUIMessagesToModel(): handles data URLs for
│                               #     images/PDFs, extracts base64, maps tool results
│                               #   - verifyLean tool: Zod schema, calls lean-runner
│                               #   - System prompt with Lean 4 guidelines, output format,
│                               #     nonlinear arithmetic hints
├── components/
│   └── chat.tsx                # Full chat UI (~900 lines):
│                               #   - Collapsible sidebar with session history
│                               #   - New chat button (header + sidebar)
│                               #   - 4-step progress tracker with cycling status messages,
│                               #     retry counter, and error hints
│                               #   - Tool invocation cards (amber/green/red)
│                               #   - Insights panel with Math/Lean tabs
│                               #   - Multi-file upload (images + PDFs)
│                               #   - 6 example proof buttons
│                               #   - Lean identifier -> Mathlib doc hyperlinks
│                               #   - KaTeX math rendering in all markdown
│                               #   - Auto-scroll, auto-resize textarea
├── instrumentation.ts          # Sentry server instrumentation
├── instrumentation-client.ts   # Sentry client instrumentation
└── lib/
    ├── lean-runner.ts          # Vercel Sandbox lifecycle:
    │                           #   - Singleton sandbox with 5-min TTL
    │                           #   - Downloads elan-init.sh from GitHub
    │                           #   - Installs Lean 4 v4.16.0 via elan
    │                           #   - writeFiles() + runCommand() for each proof
    │                           #   - Returns { success, output, errors, leanCode }
    └── session-store.ts        # Browser storage management:
                                #   - ChatSession type (id, title, timestamps, messages)
                                #   - localStorage CRUD for long-term persistence
                                #   - sessionStorage for active session ID (per-tab)
                                #   - Auto title extraction from first user message
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Google AI Studio](https://aistudio.google.com) API key (for Gemini)
- A [Vercel](https://vercel.com) account with Sandbox access (Pro plan)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/agent-qed.git
cd agent-qed

# Install dependencies
npm install

# Link to Vercel (required for Sandbox access)
npx vercel link
npx vercel env pull

# Add your Gemini API key
echo 'GOOGLE_GENERATIVE_AI_API_KEY=your-key-here' >> .env.local

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `VERCEL_OIDC_TOKEN` | Auto | Auto-generated by `vercel env pull` for Sandbox auth |
| `SENTRY_AUTH_TOKEN` | No | Sentry auth token for source map uploads |

### Deploy to Vercel

```bash
# Set environment variable on Vercel
npx vercel env add GOOGLE_GENERATIVE_AI_API_KEY

# Deploy to production
npx vercel --prod
```

---

## How It Works

### The Agent Loop

AgentQED uses the Vercel AI SDK's multi-step agent loop (`stopWhen: stepCountIs(12)`) with a single tool:

**`verifyLean`** — Takes Lean 4 code as input, executes it in a Vercel Sandbox, returns pass/fail with compiler output.

The loop works as follows:
1. Gemini generates Lean 4 code from the user's proof
2. Gemini calls the `verifyLean` tool
3. The tool writes the code to a sandbox and runs the Lean compiler
4. If the compiler succeeds, the loop ends and Gemini explains the proof
5. If the compiler fails, Gemini reads the error, fixes the code, and calls `verifyLean` again
6. This repeats until success or 12 steps are reached

### Lean 4 in Vercel Sandbox

The Lean compiler runs in a [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) — an isolated Firecracker microVM:

- **First request**: Creates a sandbox, downloads [elan](https://github.com/leanprover/elan) (Lean version manager), installs Lean 4 v4.16.0 (~30-60 seconds)
- **Subsequent requests**: Reuses the existing sandbox (instant, within 5-minute TTL)
- **Per proof**: Writes `Proof.lean` via `writeFiles()`, runs compiler via `runCommand()`, parses exit code + output

### Multi-Modal Input

Gemini 3.1 Pro's vision capabilities enable:
- **Images**: Photos of handwritten proofs on paper/whiteboard
- **PDFs**: Multi-page mathematical documents
- **Multiple files**: Upload several images/PDFs at once

Files are converted to base64 data URLs on the client and sent as `file` parts in the AI SDK message format.

### Insights Panel

The right-side panel extracts structured sections from Gemini's response:

| Tab | Section | Content |
|-----|---------|---------|
| **Math** | Mathematical Intuition | Pure math explanation — no Lean references |
| **Math** | Why This Matters | Real-world applications in math, CS, physics |
| **Lean** | Lean 4 Formalization | Tactics used, Lean-specific tricks, formalization strategy |

### Lean Documentation Links

Inline code references (e.g., `Nat.add_comm`, `simp`, `omega`) are automatically hyperlinked to the [Mathlib documentation](https://leanprover-community.github.io/mathlib4_docs/) using the `find/#doc/` search endpoint. This works for:
- **Tactics**: `simp`, `omega`, `ring`, `linarith`, `norm_num`, etc.
- **Lemmas**: `Nat.add_comm`, `List.reverse_reverse`, `And.intro`, etc.
- **Any qualified Lean name**: Automatically detected by pattern matching

---

## Example Proofs

The app includes 6 pre-built examples:

| Proof | Domain | Key Tactics |
|-------|--------|-------------|
| Modus Ponens | Propositional Logic | `apply`, `exact` |
| 0 + n = n | Natural Number Arithmetic | `induction`, `simp` |
| A and B implies B and A | Logic | `constructor`, `exact` |
| Double Negation | Decidable Propositions | `intro`, `exact`, `decide` |
| List Reverse Reverse | Data Structures | `induction`, `simp` |
| Sum of First n Naturals | Number Theory | `induction`, `omega`, `calc` |

---

## Known Limitations

1. **No Mathlib**: Only Lean 4's core library is available. Proofs requiring Mathlib (advanced algebra, topology, etc.) will fail.
2. **Cold start**: First request takes ~30-60 seconds to install Lean in the sandbox. Subsequent requests are instant.
3. **Sandbox timeout**: The sandbox lives for 5 minutes. If idle longer, the next request re-creates it.
4. **Nonlinear arithmetic**: `omega` only handles linear arithmetic. For polynomial equations, the agent uses `ring` or manual `calc` chains, which may require more retry attempts.
5. **Large images**: Very high-resolution photos may be slow to upload as base64 data URLs.

---

## Cost Estimate

At Google AI Studio pay-as-you-go rates:

| Metric | Value |
|--------|-------|
| Input tokens per proof | ~1,250 (1 attempt) / ~1,850 (with retry) |
| Output tokens per proof | ~3,700 (1 attempt) / ~5,900 (with retry) |
| Cost per proof | ~$0.05 - $0.15 |
| Hackathon total usage | ~$3.50 estimated |

---

## License

MIT
