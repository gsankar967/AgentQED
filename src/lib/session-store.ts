export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: any[];
}

const STORAGE_KEY = "agentqed_sessions";
const ACTIVE_SESSION_KEY = "agentqed_active_session";

function getSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_SESSION_KEY);
}

export function setActiveSessionId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    sessionStorage.setItem(ACTIVE_SESSION_KEY, id);
  } else {
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  }
}

export function listSessions(): ChatSession[] {
  return getSessions().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): ChatSession | null {
  return getSessions().find((s) => s.id === id) || null;
}

export function saveSession(session: ChatSession) {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  saveSessions(sessions);
}

export function deleteSession(id: string) {
  const sessions = getSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function extractTitle(messages: any[]): string {
  const firstUser = messages.find((m: any) => m.role === "user");
  if (!firstUser) return "New proof";
  const textPart = firstUser.parts?.find((p: any) => p.type === "text");
  const text = textPart?.text || "";
  return text.length > 60 ? text.substring(0, 57) + "..." : text || "New proof";
}
