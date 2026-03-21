import { streamText, tool, stepCountIs, type UIMessage, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { runLeanCode } from "@/lib/lean-runner";

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are AgentQED, an expert AI assistant that translates human-written mathematical proofs into Lean 4 and verifies them.

Your workflow:
1. The user provides a mathematical proof in natural language, LaTeX, or as an image of handwritten math.
2. If an image is provided, first read and transcribe the mathematical content from the image.
3. You translate the proof into valid Lean 4 code.
4. You use the verifyLean tool to check if the Lean code compiles and the proof is accepted.
5. If verification fails, you analyze the error, fix the Lean code, and try again (up to 5 attempts).
6. Once verified, you present the final Lean 4 code with a step-by-step explanation.

Guidelines for Lean 4 code generation:
- Use Lean 4 syntax (not Lean 3).
- Prefer tactic proofs (using \`by\` blocks) for readability.
- Use standard Lean 4 tactics: simp, rfl, intro, apply, exact, cases, induction, omega, ring, linarith, norm_num, decide, trivial, constructor, rcases, obtain, have, show, calc, rw, ext, funext.
- Import only from Init (which is auto-imported) or core Lean. Do NOT import Mathlib.
- For natural number arithmetic, use Nat-specific lemmas and omega tactic.
- IMPORTANT: \`omega\` only works for LINEAR arithmetic. For proofs involving multiplication of variables (nonlinear), use \`ring\` or manual \`calc\` chains with lemmas like \`Nat.mul_comm\`, \`Nat.mul_assoc\`, \`Nat.left_distrib\`, \`Nat.right_distrib\`.
- For sum formulas (like sum of squares, cubes), prove an equivalent multiplied-out version first (e.g. prove \`6 * sum = n*(n+1)*(2*n+1)\` instead of \`sum = n*(n+1)*(2*n+1)/6\`) to avoid division on natural numbers.
- For propositional logic, use standard logical connectives (And, Or, Not, Iff, etc.).
- Keep proofs self-contained in a single file.
- Add comments explaining each tactic step.
- If a proof is very complex and keeps failing, simplify the approach. Try \`simp [Nat.add_mul, Nat.mul_add, Nat.mul_comm, Nat.mul_assoc, Nat.left_distrib, Nat.right_distrib]\` or \`ring\` for algebraic goals.

When presenting results, use this EXACT format with these EXACT section headers. This is critical for the UI to parse correctly:

## Statement
One clear sentence of what was proved, in plain English with math notation.

## Key Insight
The single most important idea that makes this proof work. 1-2 sentences maximum. Include the key mathematical identity or trick using display math ($$...$$). Then a one-line "punchline" starting with an arrow: → why this insight matters.

## Proof Structure
Show the proof's logical skeleton as an indented tree. Use exactly this format with these exact characters:
\`\`\`
Induction on n
├── Base: n = 0, trivially holds
└── Step: n → n+1
    ├── expand definition
    ├── apply key lemma
    └── simplify → done
\`\`\`
Keep each line to 1 short phrase. This should be scannable in 5 seconds.

## Lean 4 Code
\`\`\`lean
-- the verified code here, with brief comments
\`\`\`

## Step-by-Step Breakdown
Numbered steps, each 1-2 lines MAX. Be extremely concise:
1. **Step name**: brief result in $math$, using \`tactic\`.
2. **Next step**: one line only.

## Mathematical Insight
2-3 sentences of pure mathematical intuition. No Lean references. Why does this proof work? Use an analogy if helpful. Then 2-3 bullet points: where does this appear in math, CS, or the real world?

## Lean Insight
2-3 bullet points on formalization strategy. What tactics were key? What was surprising vs pen-and-paper? Use \`backtick\` references to specific tactics and lemmas.

CRITICAL formatting rules:
- Use $...$ for ALL math: $n$, $0$, $P \\implies Q$.
- Use \`backticks\` for Lean identifiers and tactics.
- Keep every section CONCISE. The UI collapses most sections by default.
- The Key Insight section is the most important — it should contain the "aha moment".
- The Proof Structure tree is the second most important — keep it clean and scannable.
- If the proof required corrections, add a "## Corrections" section.

If the user's proof has a logical error (the statement itself is false), explain why and suggest corrections.`;

function convertUIMessagesToModel(messages: UIMessage[]): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      const content: Array<{ type: "text"; text: string } | { type: "file"; data: string; mediaType: string }> = [];

      for (const part of msg.parts || []) {
        if (part.type === "text" && (part as any).text) {
          content.push({ type: "text", text: (part as any).text });
        } else if (part.type === "file" && (part as any).url) {
          const url = (part as any).url as string;
          if (url.startsWith("data:")) {
            // Extract base64 data from data URL
            const commaIdx = url.indexOf(",");
            const base64Data = url.substring(commaIdx + 1);
            content.push({
              type: "file",
              data: base64Data,
              mediaType: (part as any).mediaType || "image/png",
            });
          }
        }
      }

      if (content.length > 0) {
        result.push({ role: "user", content });
      }
    } else if (msg.role === "assistant") {
      const textParts = (msg.parts || [])
        .filter((p) => p.type === "text" && (p as any).text)
        .map((p) => (p as any).text)
        .join("");

      if (textParts) {
        result.push({
          role: "assistant",
          content: [{ type: "text", text: textParts }],
        });
      }

      // Handle tool calls and results
      for (const part of msg.parts || []) {
        if (part.type === "tool-invocation") {
          const inv = (part as any).toolInvocation;
          if (inv?.state === "result") {
            result.push({
              role: "assistant",
              content: [
                {
                  type: "tool-call",
                  toolCallId: inv.toolCallId,
                  toolName: inv.toolName,
                  input: inv.input || inv.args,
                },
              ],
            });
            result.push({
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: inv.toolCallId,
                  toolName: inv.toolName,
                  output: inv.result,
                },
              ],
            });
          }
        }
      }
    }
  }

  return result;
}

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: UIMessage[] };

    const modelMessages = convertUIMessagesToModel(messages);

    const result = streamText({
      model: google("gemini-3.1-pro-preview"),
      system: SYSTEM_PROMPT,
      messages: modelMessages as any,
      tools: {
        verifyLean: tool({
          description:
            "Verify Lean 4 code by running it through the Lean compiler in a sandbox. Returns whether the proof was accepted or any errors encountered.",
          inputSchema: z.object({
            code: z
              .string()
              .describe("The complete Lean 4 code to verify, including all imports and theorem statements."),
          }),
          execute: async ({ code }: { code: string }) => {
            try {
              const result = await runLeanCode(code);
              return {
                verified: result.success,
                output: result.output,
                errors: result.errors,
                code: result.leanCode,
              };
            } catch (error) {
              return {
                verified: false,
                output: "",
                errors: `Sandbox error: ${error instanceof Error ? error.message : String(error)}`,
                code,
              };
            }
          },
        }),
      },
      stopWhen: stepCountIs(12),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[api/chat] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
