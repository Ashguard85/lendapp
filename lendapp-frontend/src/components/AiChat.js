import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const BASE = "/api";

export default function AiChat() {
  const { user, groupId } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hallo ${user?.name}! 👋 Ich kenne alle Gegenstände deiner Gruppe. Was möchtest du wissen?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const bottomRef = useRef();

  useEffect(() => {
    if (open && status === null) {
      fetch(`${BASE}/ai/status`, {
        headers: { "X-User-Id": String(user?.user_id) }
      }).then(r => r.json()).then(setStatus).catch(() => setStatus({ ollama: "offline" }));
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": String(user?.user_id) },
        body: JSON.stringify({ message: question, group_id: groupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      setMessages(m => [...m, { role: "assistant", text: data.answer }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", text: `❌ ${e.message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  if (!groupId) return null;

  return (
    <>
      {/* Chat-Fenster */}
      {open && (
        <div style={{
          position: "fixed", bottom: 80, right: 20, width: 340,
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", zIndex: 200,
          maxHeight: "70vh",
        }}>
          {/* Header */}
          <div style={{ background: "#1C1A16", borderRadius: "16px 16px 0 0", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ color: "#7CFF6B", fontWeight: 600, fontSize: 14 }}>LendApp AI</div>
                <div style={{ color: "#666", fontSize: 10 }}>
                  {status?.ollama === "online" ? (
                    <span style={{ color: "#7CFF6B" }}>● {status.model}</span>
                  ) : status?.ollama === "offline" ? (
                    <span style={{ color: "#FF6B6B" }}>● Ollama offline</span>
                  ) : "Verbinde…"}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "82%",
                  padding: "9px 13px",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? "#2D5016" : m.error ? "#FAEBD7" : "var(--bg2)",
                  color: m.role === "user" ? "#fff" : m.error ? "#854F0B" : "var(--text)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "var(--bg2)", borderRadius: "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: "var(--text3)" }}>
                  <span style={{ animation: "pulse 1s infinite" }}>●●●</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Schnellvorschläge */}
          {messages.length === 1 && (
            <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                "Was ist verfügbar?",
                "Was habe ich ausgeliehen?",
                "Was gehört mir?",
                "Was ist diese Woche zurück?",
              ].map(s => (
                <button key={s} onClick={() => { setInput(s); setTimeout(() => handleSend(), 50); }}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Frage stellen…"
              disabled={loading || status?.ollama === "offline"}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--bg2)",
                color: "var(--text)", fontSize: 13, outline: "none",
              }}
            />
            <button onClick={handleSend} disabled={loading || !input.trim() || status?.ollama === "offline"}
              style={{ background: "#2D5016", border: "none", borderRadius: 10, color: "#fff", width: 36, cursor: "pointer", fontSize: 16, opacity: loading ? 0.5 : 1 }}>
              →
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: "fixed", bottom: 24, right: 20,
        width: 52, height: 52, borderRadius: "50%",
        background: open ? "#1C1A16" : "#2D5016",
        border: "none", color: "#fff", fontSize: 22,
        cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        zIndex: 201, transition: "all 0.2s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {open ? "✕" : "🤖"}
      </button>
    </>
  );
}
