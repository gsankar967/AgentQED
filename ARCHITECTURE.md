# AgentQED - Architecture

## System Overview

```
                         ┌──────────────────────────────────────────────┐
                         │              AgentQED                      │
                         │         agent-qed.vercel.app               │
                         └──────────────────────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
              ┌─────▼─────┐         ┌─────▼─────┐         ┌─────▼─────┐
              │  Next.js   │         │  API Route │         │  Vercel   │
              │  Frontend  │         │  /api/chat │         │  Sandbox  │
              │  (React)   │◄───────►│  (Agent)   │────────►│  (Lean 4) │
              └─────┬─────┘         └───────────┘         └───────────┘
                    │
              ┌─────▼─────┐
              │ Browser    │
              │ Storage    │
              │ (sessions) │
              └───────────┘
```

## Detailed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                     │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│   │  Plain Text   │  │    LaTeX     │  │  Image/Photo │  │     PDF      │  │
│   │  "Prove that  │  │  \forall n   │  │  [handwritten│  │  [multi-page │  │
│   │   0+n = n"    │  │  \in \N ...  │  │   math]      │  │   proofs]    │  │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│          └─────────────────┴─────────────────┴─────────────────┘          │
│                                    │                                       │
└────────────────────────────────────┼───────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 16)                               │
│                                                                             │
│   src/components/chat.tsx                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │  ┌──────────────────────────┐  ┌────────────────────────────────┐  │   │
│   │  │   SIDEBAR                │  │   MAIN CHAT AREA               │  │   │
│   │  │                          │  │                                │  │   │
│   │  │  ┌────────────────────┐  │  │  ┌────────────────────────┐   │  │   │
│   │  │  │ [+] New Proof      │  │  │  │  HEADER                │   │  │   │
│   │  │  └────────────────────┘  │  │  │  [☰] AgentQED [+]    │   │  │   │
│   │  │                          │  │  │  Status: ✅/❌/⏳       │   │  │   │
│   │  │  Session History:        │  │  └────────────────────────┘   │  │   │
│   │  │  ┌────────────────────┐  │  │                                │  │   │
│   │  │  │ Modus ponens  2:14 │  │  │  ┌────────────────────────┐   │  │   │
│   │  │  │ 0+n=n proof   1:52 │  │  │  │  PROGRESS TRACKER      │   │  │   │
│   │  │  │ Induction...  1:30 │  │  │  │  [1]──[2]──[3]──[4]    │   │  │   │
│   │  │  └────────────────────┘  │  │  │  Read  Trans Comp Verif │   │  │   │
│   │  │                          │  │  └────────────────────────┘   │  │   │
│   │  │  Storage:                │  │                                │  │   │
│   │  │  - localStorage (long)   │  │  ┌────────────────────────┐   │  │   │
│   │  │  - sessionStorage (tab)  │  │  │  MESSAGES               │   │  │   │
│   │  │                          │  │  │                          │   │  │   │
│   │  └──────────────────────────┘  │  │  User: "Prove ..."      │   │  │   │
│   │                                │  │  [Tool: Compiling...]    │   │  │   │
│   │                                │  │  [Tool: ✅ Verified!]    │   │  │   │
│   │                                │  │  Assistant: "Here is..." │   │  │   │
│   │                                │  │  ```lean                 │   │  │   │
│   │                                │  │  theorem ...             │   │  │   │
│   │                                │  │  ```                     │   │  │   │
│   │                                │  └────────────────────────┘   │  │   │
│   │                                │                                │  │   │
│   │                                │  ┌────────────────────────┐   │  │   │
│   │                                │  │  INPUT BAR              │   │  │   │
│   │                                │  │  [📎] [textarea...] [➤] │   │  │   │
│   │                                │  │  (images/PDF preview)   │   │  │   │
│   │                                │  └────────────────────────┘   │  │   │
│   │                                │                                │  │   │
│   │                                └────────────────────────────────┘  │   │
│   │                                                                     │   │
│   │  useChat() hook (AI SDK v6, per-session id)                         │   │
│   │  sendMessage({ text, files[] })                                     │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                              POST /api/chat
                          (UIMessage[] stream)
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        API ROUTE (Serverless, 300s timeout)                 │
│                                                                             │
│   src/app/api/chat/route.ts                                                 │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   1. Parse UIMessage[] from request body                            │   │
│   │   2. convertUIMessagesToModel() — custom converter:                 │   │
│   │      - Text parts → { type: "text", text }                         │   │
│   │      - File parts → extract base64 from data URL                   │   │
│   │        → { type: "file", data: base64, mediaType }                 │   │
│   │      - Tool results → { type: "tool-result", output }              │   │
│   │   3. Call streamText() with Gemini 3.1 Pro Preview                  │   │
│   │                                                                     │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │              AGENT LOOP (stopWhen: stepCountIs(12))         │   │   │
│   │   │                                                             │   │   │
│   │   │   ┌──────────────┐     ┌──────────────┐                    │   │   │
│   │   │   │   Gemini      │────►│  verifyLean  │                    │   │   │
│   │   │   │   3.1 Pro     │◄────│  tool call   │                    │   │   │
│   │   │   │   Preview     │     │              │                    │   │   │
│   │   │   │              │     │  Zod schema:  │                    │   │   │
│   │   │   │  - Read image│     │  { code: z.   │                    │   │   │
│   │   │   │  - Read PDF  │     │    string() } │                    │   │   │
│   │   │   │  - Translate │     │              │                    │   │   │
│   │   │   │  - Fix errors│     │  Returns:    │                    │   │   │
│   │   │   │  - Explain   │     │  { verified, │                    │   │   │
│   │   │   │              │     │    output,   │                    │   │   │
│   │   │   │              │     │    errors,   │                    │   │   │
│   │   │   │              │     │    code }    │                    │   │   │
│   │   │   └──────────────┘     └──────┬───────┘                    │   │   │
│   │   │                               │                             │   │   │
│   │   │         If error: retry ◄─────┘                             │   │   │
│   │   │         If success: explain + return                        │   │   │
│   │   │                                                             │   │   │
│   │   └─────────────────────────────────────────────────────────────┘   │   │
│   │                                                                     │   │
│   │   4. Stream response via toUIMessageStreamResponse()                │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                              Sandbox API call
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     VERCEL SANDBOX (Firecracker microVM)                    │
│                                                                             │
│   src/lib/lean-runner.ts                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   Sandbox Lifecycle:                                                │   │
│   │   ┌──────────┐    ┌──────────────┐    ┌────────────────────────┐   │   │
│   │   │ Create   │───►│ Download     │───►│ Install Lean 4 v4.16.0 │   │   │
│   │   │ Sandbox  │    │ elan-init.sh │    │ (cached for 5 min)     │   │   │
│   │   │ (node24) │    │ (from GitHub)│    │ via elan toolchain mgr │   │   │
│   │   └──────────┘    └──────────────┘    └────────────────────────┘   │   │
│   │                                                                     │   │
│   │   Per-Proof Execution:                                              │   │
│   │   ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐   │   │
│   │   │ writeFiles() │───►│ runCommand() │───►│ Parse exit code    │   │   │
│   │   │ Proof.lean   │    │ $HOME/.elan/ │    │ + stdout/stderr    │   │   │
│   │   │ to sandbox   │    │ bin/lean ... │    │ for errors/success │   │   │
│   │   └──────────────┘    └──────────────┘    └────────────────────┘   │   │
│   │                                                                     │   │
│   │   Returns: { success: bool, output: string, errors: string,        │   │
│   │             leanCode: string }                                      │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         SESSION PERSISTENCE                                 │
│                                                                             │
│   src/lib/session-store.ts                                                  │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   localStorage (long-term, survives browser close):                 │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │  key: "proofagent_sessions"                                 │   │   │
│   │   │  value: ChatSession[] = [{                                  │   │   │
│   │   │    id: "session_1711...",                                    │   │   │
│   │   │    title: "Prove modus ponens...",                           │   │   │
│   │   │    createdAt: 1711000000,                                    │   │   │
│   │   │    updatedAt: 1711000060,                                    │   │   │
│   │   │    messages: UIMessage[]  // full conversation               │   │   │
│   │   │  }, ...]                                                     │   │   │
│   │   └─────────────────────────────────────────────────────────────┘   │   │
│   │                                                                     │   │
│   │   sessionStorage (short-term, per-tab):                             │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │  key: "proofagent_active_session"                           │   │   │
│   │   │  value: "session_1711..."  // active session ID             │   │   │
│   │   └─────────────────────────────────────────────────────────────┘   │   │
│   │                                                                     │   │
│   │   Operations: list, get, save, delete, generateId, extractTitle    │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                  │
│                                                                             │
│   ┌────────────────────┐          ┌──────────────────────────────────────┐  │
│   │  Google Gemini API  │          │  Vercel Sandbox Service              │  │
│   │                    │          │                                      │  │
│   │  Model:            │          │  - Firecracker microVMs              │  │
│   │  gemini-3.1-pro-   │          │  - Isolated Linux environment        │  │
│   │  preview           │          │  - 5-min timeout, auto-cleanup       │  │
│   │                    │          │  - Network access for elan install   │  │
│   │  Capabilities:     │          │  - Persistent across requests        │  │
│   │  - Text generation │          │    (within timeout window)           │  │
│   │  - Vision (images) │          │                                      │  │
│   │  - PDF analysis    │          │  Runtime:                            │  │
│   │  - Tool calling    │          │  - Amazon Linux 2023                 │  │
│   │  - Multi-step      │          │  - Node.js 24 (default)              │  │
│   │    reasoning        │          │  - curl, bash, sudo available       │  │
│   │                    │          │                                      │  │
│   └────────────────────┘          └──────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Complete Proof Verification Cycle

```
 User                    Frontend              API Route             Gemini              Sandbox
  │                        │                      │                    │                    │
  │  1. Enter proof        │                      │                    │                    │
  │  (text/image/PDF)      │                      │                    │                    │
  │───────────────────────►│                      │                    │                    │
  │                        │                      │                    │                    │
  │                        │  2. Save to           │                    │                    │
  │                        │  sessionStorage       │                    │                    │
  │                        │                      │                    │                    │
  │  [Progress: Reading]   │  3. POST /api/chat   │                    │                    │
  │◄───────────────────────│  UIMessage[]          │                    │                    │
  │                        │─────────────────────►│                    │                    │
  │                        │                      │  4. Convert msgs   │                    │
  │                        │                      │  (data URLs →      │                    │
  │                        │                      │   base64 files)    │                    │
  │                        │                      │                    │                    │
  │                        │                      │  5. streamText()   │                    │
  │                        │                      │  with system prompt│                    │
  │  [Progress: Translating]                      │───────────────────►│                    │
  │◄───────────────────────│                      │                    │                    │
  │                        │                      │  6. Tool call:     │                    │
  │                        │                      │  verifyLean(code)  │                    │
  │                        │                      │◄───────────────────│                    │
  │                        │                      │                    │                    │
  │  [Progress: Compiling] │                      │  7. Create sandbox │                    │
  │◄───────────────────────│                      │  + install Lean    │                    │
  │                        │                      │───────────────────────────────────────►│
  │                        │                      │                    │                    │
  │                        │                      │  8. Write Proof.lean                   │
  │                        │                      │  + run `lean` compiler                 │
  │                        │                      │───────────────────────────────────────►│
  │                        │                      │                    │                    │
  │                        │                      │  9. Return result  │                    │
  │                        │                      │  (success/errors)  │                    │
  │                        │                      │◄───────────────────────────────────────│
  │                        │                      │                    │                    │
  │                        │                      │  10. Tool result   │                    │
  │                        │                      │  back to Gemini    │                    │
  │                        │                      │───────────────────►│                    │
  │                        │                      │                    │                    │
  │                        │                      │     ┌──────────────┤                    │
  │                        │                      │     │ If error:    │                    │
  │  [Progress: Attempt 2] │                      │     │ Fix code and │                    │
  │◄───────────────────────│                      │     │ retry (→ 6)  │                    │
  │                        │                      │     └──────────────┤                    │
  │                        │                      │                    │                    │
  │  [Progress: Verified!] │                      │  11. Final response│                    │
  │◄───────────────────────│                      │  (explanation +    │                    │
  │                        │                      │   verified code)   │                    │
  │                        │                      │◄───────────────────│                    │
  │                        │                      │                    │                    │
  │                        │  12. Stream UI chunks│                    │                    │
  │                        │◄─────────────────────│                    │                    │
  │                        │                      │                    │                    │
  │                        │  13. Save session    │                    │                    │
  │                        │  to localStorage     │                    │                    │
  │                        │                      │                    │                    │
  │  14. See verified      │                      │                    │                    │
  │  proof + explanation   │                      │                    │                    │
  │◄───────────────────────│                      │                    │                    │
  │                        │                      │                    │                    │
```

## UI Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PROGRESS TRACKER                               │
│                                                                         │
│   Infers current step from streamed message parts:                      │
│                                                                         │
│   ┌────────┐    ┌────────────┐    ┌───────────┐    ┌──────────┐       │
│   │ Reading │───►│ Translating│───►│ Compiling │───►│ Verified │       │
│   │  proof  │    │  to Lean 4 │    │ in sandbox│    │ complete │       │
│   └────────┘    └────────────┘    └───────────┘    └──────────┘       │
│    step 0         step 1            step 2           step 3            │
│                                                                         │
│   Detection logic:                                                      │
│   - step 0: isLoading && no assistant parts yet                         │
│   - step 1: assistant text contains "```lean" or "Lean 4"              │
│   - step 2: tool-invocation with state "call" or "partial-call"        │
│   - step 3: tool-invocation result with verified=true                   │
│   - retry:  tool-invocation result with verified=false → back to step 1│
│                                                                         │
│   Visual states:                                                        │
│   - Done:   green circle with checkmark                                 │
│   - Active: purple pulsing circle                                       │
│   - Future: grey circle                                                 │
│   - Retry:  amber "Attempt N" counter                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       TOOL INVOCATION CARDS                             │
│                                                                         │
│   Three states, color-coded:                                            │
│                                                                         │
│   ┌─ Amber ─────────────────────────────────────┐                      │
│   │ ⏳ Running Lean 4 compiler in sandbox...     │  state: "call"      │
│   └──────────────────────────────────────────────┘                      │
│                                                                         │
│   ┌─ Green ─────────────────────────────────────┐                      │
│   │ ✅ Proof verified by Lean 4!                 │  verified: true      │
│   └──────────────────────────────────────────────┘                      │
│                                                                         │
│   ┌─ Red ───────────────────────────────────────┐                      │
│   │ ❌ Verification failed — analyzing errors... │  verified: false     │
│   │ > error: unknown identifier 'foo'            │                      │
│   └──────────────────────────────────────────────┘                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16 + React 19 | App framework |
| Styling | Tailwind CSS v4 | Dark theme UI |
| Icons | Lucide React | UI icons |
| Markdown | react-markdown | Render proof explanations |
| AI SDK | Vercel AI SDK v6 | Streaming, tool calling, agent loop |
| AI Model | Gemini 3.1 Pro Preview | Proof translation, vision, multi-step reasoning |
| Sandbox | Vercel Sandbox (Firecracker) | Isolated Lean 4 execution |
| Proof Engine | Lean 4 v4.16.0 (via elan) | Formal mathematical verification |
| Persistence | localStorage + sessionStorage | Chat session history |
| Deployment | Vercel (Fluid Compute) | Serverless with 300s timeout |

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, fonts, metadata
│   ├── page.tsx                # Renders <Chat /> component
│   ├── globals.css             # Dark theme, scrollbar, prose styles
│   └── api/
│       └── chat/
│           └── route.ts        # POST handler: UIMessage → Gemini → Sandbox → stream
│                               # Custom convertUIMessagesToModel() for data URL handling
├── components/
│   └── chat.tsx                # Full chat UI:
│                               #   - Collapsible sidebar with session history
│                               #   - New chat button (header + sidebar)
│                               #   - 4-step progress tracker with retry counter
│                               #   - Tool invocation cards (amber/green/red)
│                               #   - Multi-file upload (images + PDFs)
│                               #   - 6 example proof buttons
│                               #   - Auto-scroll, auto-resize textarea
└── lib/
    ├── lean-runner.ts          # Sandbox lifecycle: create → install lean → run proofs
    │                           #   - Singleton sandbox with 5-min TTL
    │                           #   - elan installer from GitHub
    │                           #   - writeFiles() + runCommand() API
    └── session-store.ts        # Session persistence:
                                #   - ChatSession type (id, title, timestamps, messages)
                                #   - localStorage CRUD (list, get, save, delete)
                                #   - sessionStorage for active session ID
                                #   - Auto title extraction from first message
```
