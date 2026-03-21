# AgentQED — 3-Minute Live Demo Script

## Opening (20 sec)

"Every math student has written a proof they thought was right — only to find a gap they missed. Every researcher has spent hours checking whether an argument actually holds.

AgentQED solves this. You write a proof in plain English — or take a photo of handwritten math — and it formally verifies it using the Lean 4 theorem prover. Not LLM judgment. Real compiler verification."

## Demo 1: Simple Proof (40 sec)

**Click "Modus ponens" example**

"Watch the pipeline: Gemini reads the proof, translates it to Lean 4, spins up an isolated sandbox, runs the Lean compiler, and — verified.

Notice what just happened: the Key Insight box shows you WHY the proof works — function application under Curry-Howard. The Proof Structure shows the logical skeleton. The Lean code is collapsed by default because the insight matters more than the syntax."

## Demo 2: Harder Proof — Show Self-Correction (50 sec)

**Click "Sum of first n naturals"**

"This one's harder — it requires induction. Watch the progress bar. If the first attempt fails, the agent reads the compiler errors, fixes its own code, and retries. It can do this up to 12 times.

This is where it gets interesting — it avoided division on natural numbers by proving the multiplied-out version first. That's a real mathematical strategy, not just code generation."

## Demo 3: Handwritten Proof — The Killer Feature (40 sec)

**Upload photo of handwritten proof**

"Here's what makes this unique. I wrote this proof on paper. I take a photo. Gemini's vision reads the handwriting, extracts the math, translates it to Lean 4, and verifies it in the sandbox.

This is multi-modal proof verification — from pen and paper to formal verification in one step."

## Architecture Highlight (20 sec)

"The stack: Gemini 3.1 Pro for translation and vision. Vercel Sandbox — Firecracker microVMs — for isolated Lean compilation. The AI SDK agent loop for self-correction. Every identifier in the output links to Mathlib documentation. Sessions persist across refreshes."

## Impact Pitch (10 sec)

"This bridges the gap between informal mathematical reasoning and formal verification — a gap that has existed since Euclid. Students can verify proofs instantly. Researchers can formalize intuitive arguments. And unlike every other AI math tool, this one gives you compiler-verified correctness, not LLM confidence."

---

## Q&A Prep

**"How is this different from just asking ChatGPT to check a proof?"**
ChatGPT can only say "this looks right" — it hallucinates. We run the actual Lean 4 compiler. If Lean says it's verified, it IS verified. Mathematical certainty, not statistical confidence.

**"What if Lean can't verify a proof?"**
The agent retries up to 12 times, reading compiler errors and fixing its code. For proofs beyond Lean 4's core library (needing Mathlib), we clearly communicate that limitation.

**"What Vercel tools are you using?"**
AI SDK v6 for the agent loop and streaming. Vercel Sandbox (Firecracker microVMs) for isolated Lean execution. Deployed on Vercel with Fluid Compute (300s timeout). Sentry for monitoring.

**"What Google tools are you using?"**
Gemini 3.1 Pro Preview for proof translation, vision (handwritten math), and multi-step reasoning via tool calling.

**"Can it handle advanced math?"**
It handles propositional logic, natural number arithmetic, induction, list operations, and basic algebra. For advanced topics (topology, abstract algebra) you'd need Mathlib, which is a future extension.

**"What's the long-term vision?"**
An AI teaching assistant that doesn't just verify — it guides understanding. The collapsible Key Insight, Proof Structure tree, and step breakdown are designed for learning, not just checking. Eventually: Mathlib support, proof search, LaTeX export, classroom integration.

---

## Timing Checklist
- [ ] 0:00 - 0:20 — Opening pitch (problem + solution)
- [ ] 0:20 - 1:00 — Demo 1: Modus ponens (show pipeline + structured output)
- [ ] 1:00 - 1:50 — Demo 2: Sum formula (show self-correction + mathematical strategy)
- [ ] 1:50 - 2:30 — Demo 3: Handwritten proof (multi-modal killer feature)
- [ ] 2:30 - 2:50 — Architecture (tech stack)
- [ ] 2:50 - 3:00 — Impact close

## Pre-Demo Checklist
- [ ] Open https://agent-qed.vercel.app in browser
- [ ] Have handwritten proof photo ready on phone
- [ ] Clear browser cache / start fresh session
- [ ] Test one proof works before going on stage
- [ ] Have backup: run locally if Vercel has issues (`npm run dev`)
