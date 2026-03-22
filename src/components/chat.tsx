"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Code2,
  BookOpen,
  ImagePlus,
  X,
  Plus,
  History,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Lightbulb,
  TreePine,
  ArrowRight,
  Brain,
  Globe,
  Wrench,
  Mic,
  MicOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import MathBackground from "@/components/math-background";
import {
  type ChatSession,
  listSessions,
  getSession,
  saveSession,
  deleteSession,
  generateSessionId,
  extractTitle,
  getActiveSessionId,
  setActiveSessionId,
} from "@/lib/session-store";

// ─── Constants ───────────────────────────────────────────────

const EXAMPLES = [
  { label: "Sum of first n naturals", prompt: "Prove that for all natural numbers n, the sum 0 + 1 + 2 + ... + n equals n * (n + 1) / 2." },
  { label: "A and B implies B and A", prompt: "Prove that for propositions A and B, if A and B are both true, then B and A are both true (commutativity of conjunction)." },
  { label: "Double negation", prompt: "Prove that for any decidable proposition P, if not (not P) then P." },
  { label: "List reverse reverse", prompt: "Prove that reversing a list twice gives back the original list." },
  { label: "0 + n = n", prompt: "Prove by induction that for all natural numbers n, 0 + n = n." },
  { label: "Modus ponens", prompt: "Prove modus ponens: if P implies Q, and P is true, then Q is true." },
];

// ─── Lean Doc Links ──────────────────────────────────────────

const LEAN_DOC_BASE = "https://leanprover-community.github.io/mathlib4_docs/find/#doc/";
const LEAN_TACTICS = new Set(["simp","rfl","intro","apply","exact","cases","induction","omega","ring","linarith","norm_num","decide","trivial","constructor","rcases","obtain","have","show","calc","rw","ext","funext","assumption","contradiction","exfalso","refl","symm","trans","congr","unfold","dsimp","norm_cast","push_neg","by_contra","classical","tauto","aesop"]);

function getLeanDocUrl(id: string): string | null {
  if (LEAN_TACTICS.has(id)) return LEAN_DOC_BASE + encodeURIComponent(id);
  if (/^[A-Z][a-zA-Z0-9]*\.[a-zA-Z_][a-zA-Z0-9_.]*$/.test(id)) return LEAN_DOC_BASE + encodeURIComponent(id);
  return null;
}

function LeanCode({ children, className }: { children: React.ReactNode; className?: string }) {
  if (className?.startsWith("language-")) return <code className={className}>{children}</code>;
  const text = String(children).trim();
  const url = getLeanDocUrl(text);
  if (url) return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-code-link"><code>{children}</code></a>;
  return <code>{children}</code>;
}

const mdComponents = { code: LeanCode as any };

function Md({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>{children}</ReactMarkdown>;
}

// ─── Tool Part Helpers ───────────────────────────────────────

function isToolPart(p: any): boolean {
  if (!p?.type) return false;
  return p.type === "tool-invocation" || p.type === "dynamic-tool" || p.type === "tool-verifyLean" || (typeof p.type === "string" && p.type.startsWith("tool-"));
}

function getToolState(p: any): "pending" | "running" | "done" {
  if (p.output !== undefined || p.result !== undefined || p.toolInvocation?.result !== undefined) return "done";
  const state = p.state || p.toolInvocation?.state || "";
  if (state === "output-available" || state === "result") return "done";
  if (p.input !== undefined || p.toolInvocation?.input !== undefined) return "running";
  if (state === "input-streaming" || state === "input-available" || state === "call" || state === "partial-call") return "running";
  return "pending";
}

function getToolOutput(p: any): any {
  return p.output || p.result || p.toolInvocation?.result || p.toolInvocation?.output || null;
}

// ─── Section Parser ──────────────────────────────────────────

function extractSection(text: string, heading: string): string | null {
  const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = regex.exec(text);
  return match ? match[1].trim() : null;
}

// ─── Tool Card ───────────────────────────────────────────────

function ImageCard({ part }: { part: any }) {
  if (!isToolPart(part)) return null;
  const state = getToolState(part);
  // Check if this is a generateVisualization tool
  const toolName = part.toolName || (typeof part.type === "string" ? part.type.replace("tool-", "") : "");
  if (toolName !== "generateVisualization") return null;

  if (state === "running") {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-2)] px-4 py-3 flex items-center gap-2.5">
        <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
        <span className="text-xs font-medium text-[var(--text-secondary)]">Generating proof visualization...</span>
      </div>
    );
  }

  if (state === "done") {
    const output = getToolOutput(part);
    if (output?.success && output?.imageBase64) {
      return (
        <div className="rounded-xl border border-[var(--violet-border)] bg-[var(--surface-2)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-400">Proof Visualization</span>
          </div>
          <div className="p-3">
            <img
              src={`data:${output.mediaType || "image/png"};base64,${output.imageBase64}`}
              alt="Mathematical proof visualization"
              className="w-full rounded-lg"
            />
          </div>
        </div>
      );
    }
    return null;
  }
  return null;
}

function ToolCard({ part }: { part: any }) {
  const [showErrors, setShowErrors] = useState(false);
  if (!isToolPart(part)) return null;
  const state = getToolState(part);

  if (state === "running") {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-2)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">Running Lean 4 compiler...</span>
        </div>
        <div className="h-0.5 overflow-hidden bg-[var(--surface-3)]">
          <div className="tool-progress-bar" />
        </div>
      </div>
    );
  }

  if (state === "done") {
    const output = getToolOutput(part);
    const verified = output?.verified;
    return (
      <div className={`rounded-xl border overflow-hidden ${verified ? "border-[var(--emerald-border)]" : "border-[var(--red-border)]"} bg-[var(--surface-2)]`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {verified ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
            <span className={`text-xs font-semibold ${verified ? "text-emerald-300" : "text-red-300"}`}>
              {verified ? "Proof verified by Lean 4" : "Verification failed"}
            </span>
          </div>
          {!verified && output?.errors && (
            <button onClick={() => setShowErrors(!showErrors)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors">
              {showErrors ? "Hide errors" : "Show errors"}
            </button>
          )}
        </div>
        {!verified && showErrors && output?.errors && (
          <div className="px-4 pb-3">
            <pre className="text-[11px] font-mono text-red-400/60 bg-[var(--surface-3)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
              {output.errors}
            </pre>
          </div>
        )}
        <div className={`h-0.5 ${verified ? "bg-emerald-500" : "bg-red-500"}`} />
      </div>
    );
  }
  return null;
}

// ─── Proof Result Card ───────────────────────────────────────

function ProofResultCard({ text }: { text: string }) {
  const proofFeedback = extractSection(text, "Proof Feedback");
  const statement = extractSection(text, "Statement");
  const keyInsight = extractSection(text, "Key Insight");
  const proofStructure = extractSection(text, "Proof Structure");
  const leanCode = extractSection(text, "Lean 4 Code");
  const breakdown = extractSection(text, "Step-by-Step Breakdown");
  const mathInsight = extractSection(text, "Mathematical Insight");
  const leanInsight = extractSection(text, "Lean Insight");

  // If we can't parse structured sections, fall back to raw markdown
  const hasStructure = statement || keyInsight || proofStructure;
  if (!hasStructure) {
    return (
      <div className="proof-prose text-sm text-[var(--text-secondary)] leading-relaxed">
        <Md>{text}</Md>
      </div>
    );
  }

  return (
    <div className="space-y-4 msg-animate">
      {/* Proof Feedback — shown first when user submitted their own proof */}
      {proofFeedback && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">Feedback on Your Proof</span>
          </div>
          <div className="text-sm text-[var(--text-secondary)] leading-relaxed proof-prose">
            <Md>{proofFeedback}</Md>
          </div>
        </div>
      )}

      {/* Statement */}
      {statement && (
        <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
          <Md>{statement}</Md>
        </div>
      )}

      {/* Key Insight — the hero */}
      {keyInsight && (
        <div className="insight-highlight pl-5">
          <div className="flex items-center gap-2 mb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-400">Key Insight</span>
          </div>
          <div className="text-sm text-[var(--text-primary)] leading-relaxed proof-prose">
            <Md>{keyInsight}</Md>
          </div>
        </div>
      )}

      {/* Proof Structure tree */}
      {proofStructure && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <TreePine className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Proof Structure</span>
          </div>
          <pre className="proof-tree whitespace-pre-wrap">{proofStructure.replace(/```/g, "").trim()}</pre>
        </div>
      )}

      {/* Collapsible: Lean Code */}
      {leanCode && (
        <details className="collapsible-section">
          <summary>
            <ChevronRight className="w-3.5 h-3.5 chevron" />
            <Code2 className="w-3.5 h-3.5 text-violet-400" />
            <span>Lean 4 Code</span>
          </summary>
          <div className="section-content proof-prose text-sm">
            <Md>{leanCode.startsWith("```") ? leanCode : "```lean\n" + leanCode + "\n```"}</Md>
          </div>
        </details>
      )}

      {/* Collapsible: Step Breakdown */}
      {breakdown && (
        <details className="collapsible-section">
          <summary>
            <ChevronRight className="w-3.5 h-3.5 chevron" />
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            <span>Step-by-Step Breakdown</span>
          </summary>
          <div className="section-content proof-prose text-sm text-[var(--text-secondary)]">
            <Md>{breakdown}</Md>
          </div>
        </details>
      )}

      {/* Collapsible: Math Insight */}
      {mathInsight && (
        <details className="collapsible-section">
          <summary>
            <ChevronRight className="w-3.5 h-3.5 chevron" />
            <Brain className="w-3.5 h-3.5 text-blue-400" />
            <span>Mathematical Insight</span>
          </summary>
          <div className="section-content proof-prose text-sm text-[var(--text-secondary)]">
            <Md>{mathInsight}</Md>
          </div>
        </details>
      )}

      {/* Collapsible: Lean Insight */}
      {leanInsight && (
        <details className="collapsible-section">
          <summary>
            <ChevronRight className="w-3.5 h-3.5 chevron" />
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lean Formalization Details</span>
          </summary>
          <div className="section-content proof-prose text-sm text-[var(--text-secondary)]">
            <Md>{leanInsight}</Md>
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Progress Bar ────────────────────────────────────────────

const STEPS = ["Reading input", "Translating to Lean 4", "Compiling in sandbox", "Verified"];

function ProgressBar({ messages, isLoading }: { messages: any[]; isLoading: boolean }) {
  let step = -1;
  let attempts = 0;
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts || []) {
      const p = part as any;
      if (p.type === "text" && p.text) {
        step = Math.max(step, 0);
        if (p.text.includes("```lean") || p.text.includes("Lean 4") || p.text.includes("theorem")) step = Math.max(step, 1);
      }
      if (isToolPart(p)) {
        const ts = getToolState(p);
        if (ts === "running") step = 2;
        if (ts === "done") {
          attempts++;
          const out = getToolOutput(p);
          step = out?.verified ? 3 : 1;
        }
      }
    }
  }
  if (step < 0 && isLoading) step = 0;
  if (step < 0) return null;

  return (
    <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-0)]/60 backdrop-blur-sm px-6 py-2.5">
      <div className="max-w-3xl mx-auto flex items-center gap-1">
        {STEPS.map((label, i) => {
          const done = i < step || (i === step && !isLoading && step === 3);
          const active = i === step && isLoading;
          return (
            <div key={label} className="flex-1 flex items-center gap-2">
              <div className="flex-1">
                <div className={`h-0.5 rounded-full transition-all duration-500 ${done ? "bg-emerald-500" : active ? "bg-violet-500 animate-pulse" : "bg-[var(--border-subtle)]"}`} />
              </div>
              {i < STEPS.length - 1 || done ? null : null}
            </div>
          );
        })}
        <div className="flex items-center gap-3 ml-3">
          <span className={`text-[10px] font-medium ${step === 3 && !isLoading ? "text-emerald-400" : isLoading ? "text-violet-400" : "text-[var(--text-muted)]"}`}>
            {step === 3 && !isLoading ? "Verified" : isLoading ? STEPS[step] : STEPS[step]}
          </span>
          {attempts > 1 && <span className="text-[10px] text-amber-400">Attempt {attempts}</span>}
          {isLoading && <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />}
        </div>
      </div>
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Main Chat Component ────────────────────────────────────

export default function Chat() {
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window === "undefined") return generateSessionId();
    return getActiveSessionId() || generateSessionId();
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const { messages, sendMessage, status, setMessages } = useChat({ id: sessionId });
  const [inputValue, setInputValue] = useState("");
  const [showExamples, setShowExamples] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<{ file: File; preview: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = status === "streaming" || status === "submitted";
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleMic = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported in this browser"); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputValue(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  useEffect(() => {
    setSessions(listSessions());
    const activeId = getActiveSessionId();
    if (activeId) {
      const session = getSession(activeId);
      if (session?.messages.length) { setMessages(session.messages); setShowExamples(false); }
    }
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    saveSession({ id: sessionId, title: extractTitle(messages), createdAt: getSession(sessionId)?.createdAt || Date.now(), updatedAt: Date.now(), messages });
    setActiveSessionId(sessionId);
    setSessions(listSessions());
  }, [messages, sessionId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleNewChat = useCallback(() => {
    const id = generateSessionId();
    setSessionId(id); setMessages([]); setShowExamples(true); setActiveSessionId(id); setInputValue(""); setAttachedFiles([]);
  }, [setMessages]);

  const handleLoadSession = useCallback((id: string) => {
    const s = getSession(id);
    if (!s) return;
    setSessionId(id); setMessages(s.messages); setActiveSessionId(id); setShowExamples(false); setSidebarOpen(false);
  }, [setMessages]);

  const handleDeleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation(); deleteSession(id); setSessions(listSessions());
    if (id === sessionId) handleNewChat();
  }, [sessionId, handleNewChat]);

  const handleSend = async (text?: string) => {
    const msg = text || inputValue;
    if ((!msg.trim() && !attachedFiles.length) || isLoading) return;
    if (attachedFiles.length) {
      const parts = await Promise.all(attachedFiles.map(async ({ file }) => ({ type: "file" as const, mediaType: file.type, url: await fileToDataUrl(file) })));
      sendMessage({ text: msg || "Read the mathematical proof from these files and translate it to Lean 4, then verify it.", files: parts });
      attachedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setAttachedFiles([]);
    } else {
      sendMessage({ text: msg });
    }
    setInputValue(""); setShowExamples(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files.map(f => ({ file: f, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "" }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (i: number) => {
    setAttachedFiles(prev => { const r = prev[i]; if (r.preview) URL.revokeObjectURL(r.preview); return prev.filter((_, j) => j !== i); });
  };

  const lastVerification = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      for (let j = (messages[i].parts?.length || 0) - 1; j >= 0; j--) {
        const p = messages[i].parts![j] as any;
        if (isToolPart(p) && getToolState(p) === "done") {
          const o = getToolOutput(p);
          if (o?.verified !== undefined) return o.verified;
        }
      }
    }
    return null;
  })();

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="flex h-screen relative">
      <MathBackground />
      <div className="fixed inset-0 bg-vignette z-[1] pointer-events-none" />

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-[260px] bg-[var(--surface-0)]/95 backdrop-blur-xl border-r border-[var(--border-subtle)] transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">History</span>
            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-muted)]">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <div className="px-3 py-2.5">
            <button onClick={handleNewChat} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--border-default)] hover:border-[var(--violet-border)] hover:bg-[var(--violet-bg)] text-xs text-[var(--text-tertiary)] hover:text-violet-400 transition-all">
              <Plus className="w-3.5 h-3.5" /> New Proof
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
            {sessions.map(s => (
              <button key={s.id} onClick={() => handleLoadSession(s.id)} className={`w-full group flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${s.id === sessionId ? "bg-[var(--violet-bg)] border border-[var(--violet-border)] text-violet-300" : "hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)]"}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px]">{s.title}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <button onClick={(e) => handleDeleteSession(s.id, e)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--red-bg)] text-[var(--text-muted)] hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
              </button>
            ))}
            {!sessions.length && <p className="text-[11px] text-[var(--text-muted)] text-center py-6">No saved sessions</p>}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <header className="h-14 border-b border-[var(--border-subtle)] px-5 flex items-center justify-between bg-[var(--surface-1)]/90 backdrop-blur-xl relative z-20">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all">
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/10">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">AgentQED</span>
          </div>
          <div className="flex items-center gap-2">
            {lastVerification === true && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--emerald-bg)] border border-[var(--emerald-border)]">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px] font-medium text-emerald-400">Verified</span>
              </div>
            )}
            {lastVerification === false && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--red-bg)] border border-[var(--red-border)]">
                <XCircle className="w-3 h-3 text-red-400" />
                <span className="text-[11px] font-medium text-red-400">Failed</span>
              </div>
            )}
            <button onClick={handleNewChat} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-violet-400 transition-all" title="New proof">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Progress bar */}
        {(isLoading || messages.some((m: any) => m.role === "assistant")) && (
          <ProgressBar messages={messages} isLoading={isLoading} />
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Landing page — centered */}
          {messages.length === 0 && showExamples && (
            <div className="flex items-center justify-center min-h-full px-4 py-12">
              <div className="max-w-2xl w-full space-y-8">
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/10 flex items-center justify-center mx-auto ring-1 ring-violet-500/10 shadow-xl shadow-violet-500/5">
                    <BookOpen className="w-7 h-7 text-violet-400" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                    Verify Mathematical Proofs
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
                    Write a proof in plain English, LaTeX, or upload handwritten math.
                    AgentQED translates it to Lean 4 and formally verifies it.
                  </p>
                  <div className="w-10 h-px bg-[var(--border-default)] mx-auto" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {EXAMPLES.map(ex => (
                    <button key={ex.label} onClick={() => handleSend(ex.prompt)} className="group text-left px-4 py-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] hover:border-[var(--violet-border)] hover:bg-[var(--violet-bg)] transition-all duration-150">
                      <div className="text-[13px] font-medium text-[var(--text-secondary)] group-hover:text-violet-400 transition-colors">{ex.label}</div>
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-1 leading-relaxed">{ex.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
              {messages.map(message => (
                <div key={message.id} className="msg-animate">
                  {/* User */}
                  {message.role === "user" && (
                    <div className="flex justify-end">
                      <div className="max-w-[70%] space-y-2">
                        {message.parts?.filter(p => p.type === "file").map((p: any, i: number) => (
                          <div key={i} className="flex justify-end">
                            {p.mediaType?.startsWith("image/") ? (
                              <img src={p.url} alt="" className="max-w-[240px] rounded-xl border border-[var(--border-default)]" />
                            ) : (
                              <div className="px-3 py-1.5 rounded-lg bg-[var(--violet-bg)] border border-[var(--violet-border)] text-[11px] text-violet-300">PDF uploaded</div>
                            )}
                          </div>
                        ))}
                        {message.parts?.filter(p => p.type === "text").map((p: any, i: number) => p.text ? (
                          <div key={i} className="px-4 py-2.5 rounded-2xl rounded-br-md bg-[var(--violet-bg)] border border-[var(--violet-border)] text-sm text-[var(--text-primary)]">
                            {p.text}
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  {/* Assistant */}
                  {message.role === "assistant" && (
                    <div className="space-y-3">
                      {(() => {
                        // Collect all text parts and tool parts
                        const parts = message.parts || [];
                        const textParts = parts.filter((p: any) => p.type === "text" && p.text).map((p: any) => p.text);
                        const fullText = textParts.join("\n");
                        const toolParts = parts.filter((p: any) => isToolPart(p));

                        // Render tool cards
                        const toolCards = toolParts.map((p: any, i: number) => {
                          const tn = p.toolName || (typeof p.type === "string" ? p.type.replace("tool-", "") : "");
                          if (tn === "generateVisualization") return <ImageCard key={`img-${i}`} part={p} />;
                          return <ToolCard key={`tool-${i}`} part={p} />;
                        });

                        // Render proof result card if we have substantial text
                        const proofCard = fullText.length > 50 ? <ProofResultCard text={fullText} /> : (
                          fullText ? <div className="proof-prose text-sm text-[var(--text-secondary)]"><Md>{fullText}</Md></div> : null
                        );

                        return (
                          <>
                            {toolCards}
                            {proofCard}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && messages.length > 0 && !messages[messages.length - 1]?.parts?.some((p: any) => isToolPart(p) && getToolState(p) === "running") && (
                <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border-subtle)] px-4 py-3.5 bg-[var(--surface-1)]/90 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-2">
                {attachedFiles.map((af, i) => (
                  <div key={i} className="relative">
                    {af.preview ? (
                      <img src={af.preview} alt="" className="max-h-20 rounded-lg border border-[var(--border-default)]" />
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-default)] text-[11px] text-[var(--text-tertiary)]">{af.file.name}</div>
                    )}
                    <button onClick={() => removeFile(i)} className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white"><X className="w-2.5 h-2.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--border-default)] bg-transparent hover:bg-[var(--surface-hover)] disabled:opacity-30 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-all flex-shrink-0" title="Upload image or PDF">
                <ImagePlus className="w-4 h-4" />
              </button>
              <button onClick={toggleMic} disabled={isLoading} className={`w-10 h-10 flex items-center justify-center rounded-xl border flex-shrink-0 transition-all ${isListening ? "bg-red-500/15 border-red-500/30 text-red-400 animate-pulse" : "border-[var(--border-default)] bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"} disabled:opacity-30`} title={isListening ? "Stop listening" : "Speak your proof"}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <textarea
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isListening ? "Listening... speak your proof" : "Type, speak, or upload a proof to verify..."}
                rows={1}
                className="flex-1 resize-none bg-[var(--surface-2)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--violet-border)] focus:ring-1 focus:ring-[var(--violet-bg)] transition-all"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || (!inputValue.trim() && !attachedFiles.length)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-all ${isLoading || (!inputValue.trim() && !attachedFiles.length) ? "bg-[var(--surface-3)] text-[var(--text-muted)]" : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/15"}`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
