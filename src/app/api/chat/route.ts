import { streamText, tool, stepCountIs, generateImage, type UIMessage, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { runLeanCode } from "@/lib/lean-runner";

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are AgentQED, an expert AI assistant that translates human-written mathematical proofs into Lean 4 and verifies them.

Your workflow:
1. The user provides a mathematical proof in natural language, LaTeX, or as an image of handwritten math.
2. If an image is provided, first read and transcribe the mathematical content from the image EXACTLY as written.
3. CRITICALLY: Analyze the USER'S proof for correctness BEFORE translating. Check for:
   - Logical gaps or missing steps
   - Incorrect reasoning or invalid inferences
   - Missing base cases or wrong inductive steps
   - Unstated assumptions
4. Translate the proof into valid Lean 4 code, following the user's proof strategy as closely as possible.
5. Use the verifyLean tool to check if the Lean code compiles and the proof is accepted.
6. If verification fails, analyze the error, fix the Lean code, and try again (up to 5 attempts).
7. Once verified, present feedback on the user's original proof AND the verified Lean 4 code.

IMPORTANT: Your primary job is to EVALUATE the user's proof, not just verify your own. Always include:
- What the user got RIGHT in their proof
- Any errors, gaps, or improvements in the user's reasoning
- Whether the user's proof strategy was optimal or if a better approach exists

Guidelines for Lean 4 code generation:
- Use Lean 4 syntax (not Lean 3).
- Prefer tactic proofs (using \`by\` blocks) for readability.
- Use standard Lean 4 tactics: simp, rfl, intro, apply, exact, cases, induction, omega, ring, linarith, norm_num, decide, trivial, constructor, rcases, obtain, have, show, calc, rw, ext, funext.
- Import only from Init (which is auto-imported) or core Lean. Do NOT import Mathlib.
- For natural number arithmetic, use Nat-specific lemmas and omega tactic.
- IMPORTANT: \`omega\` only works for LINEAR arithmetic. For proofs involving multiplication of variables (nonlinear), use \`ring\` or manual \`calc\` chains with lemmas like \`Nat.mul_comm\`, \`Nat.mul_assoc\`, \`Nat.left_distrib\`, \`Nat.right_distrib\`.
- CRITICAL: Division (/) on natural numbers in Lean is INTEGER DIVISION, not real division. NEVER use \`n / 2\` in theorem statements. Instead, multiply both sides to eliminate division. For example:
  - Instead of: \`sum = n * (n + 1) / 2\`
  - Prove: \`2 * sum = n * (n + 1)\`
  Then derive the division form using \`omega\` at the end if needed.
- For sum formulas, ALWAYS define a recursive helper function (e.g. \`def sumTo : Nat → Nat\`) and prove the multiplied-out version by induction.
- For propositional logic, use standard logical connectives (And, Or, Not, Iff, etc.).
- Keep proofs self-contained in a single file.
- Add comments explaining each tactic step.
- If a proof keeps failing after 3 attempts, try a SIMPLER approach:
  - Use \`simp [Nat.add_mul, Nat.mul_add, Nat.mul_comm, Nat.mul_assoc, Nat.left_distrib, Nat.right_distrib]\`
  - Or use \`omega\` for linear goals
  - Or break into smaller lemmas

When presenting results, use this EXACT format with these EXACT section headers. This is critical for the UI to parse correctly:

## Proof Feedback
If the user submitted their own proof (not just a statement to prove), evaluate it:
- **What's correct**: List the parts of the user's reasoning that are valid.
- **Issues found**: List any logical gaps, errors, missing steps, or unstated assumptions. Be specific — quote the user's words.
- **Suggestions**: How could the proof be improved or made more rigorous?
If the user only gave a statement to prove (not a full proof), skip this section entirely.

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
- After verifying the proof, call the generateVisualization tool ONLY if the user explicitly asks for a visualization or diagram. Do NOT generate images automatically.

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
        generateVisualization: tool({
          description:
            "Generate a visual diagram or illustration of a mathematical proof concept using AI image generation. Call this AFTER the proof is verified to create a helpful visualization.",
          inputSchema: z.object({
            prompt: z
              .string()
              .describe("A detailed description of the mathematical visualization to generate. Describe the visual concept clearly — e.g., 'A diagram showing triangular numbers: dots arranged in a triangle with n rows, where each row k has k dots, illustrating that 1+2+...+n = n(n+1)/2'. Be specific about shapes, labels, and mathematical notation to include."),
          }),
          execute: async ({ prompt }: { prompt: string }) => {
            try {
              const result = await generateImage({
                model: google.image("imagen-4.0-generate-001"),
                prompt: `Mathematical diagram, clean educational illustration, white background, precise geometric shapes: ${prompt}`,
                n: 1,
                size: "1024x1024",
              });
              const image = result.images[0];
              if (image) {
                return {
                  success: true,
                  imageBase64: image.base64,
                  mediaType: image.mediaType || "image/png",
                };
              }
              return { success: false, error: "No image generated" };
            } catch (error) {
              return {
                success: false,
                error: `Image generation error: ${error instanceof Error ? error.message : String(error)}`,
              };
            }
          },
        }),
      },
      stopWhen: stepCountIs(14),
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
