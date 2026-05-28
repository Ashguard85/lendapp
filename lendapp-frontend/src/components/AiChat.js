import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const BASE = "/api";

// Markdown-Links [text](url) → klickbare Elemente
function renderText(text, onLinkClick) {
  const parts = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0, match, key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const label = match[1];
    const url = match[2];
    parts.push(
      <a key={key++} href={url}
        onClick={(e) => { e.preventDefault(); onLinkClick(url); }}
        style={{ color: "#2D5016", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
        {label}
      </a>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function AiChat() {
  const { user, groupId } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hallo ${user?.name}! 👋 Ich helfe dir Gegenstände zu finden und zu buchen. Was suchst du?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const bottomRef = useRef();

  // Verschiebbare Position
  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lendapp_chat_pos")) || { x: 20, y: 24 }; }
    catch { return { x: 20, y: 24 }; }
  });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });

  useEffect(() => {
    if (open && status === null) {
      fetch(`${BASE}/ai/status`, { headers: { "X-User-Id": String(user?.user_id) } })
        .then(r => r.json()).then(setStatus).catch(() => setStatus({ ollama: "offline" }));
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleLinkClick(url) {
    // Interner Link? → React Router
    const match = url.match(/\/items\/(\d+)/);
    if (match) {
      setOpen(false);
      navigate(`/items/${match[1]}`);
    } else {
      window.open(url, "_blank");
    }
  }

  async function handleSend(textOverride) {
    const question = (textOverride || input).trim();
    if (!question || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", text: question }];
    setMessages(newMessages);
    setLoading(true);
    try {
      // Verlauf mitsenden (ohne Begrüssung)
      const history = newMessages.slice(1).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));
      const res = await fetch(`${BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": String(user?.user_id) },
        body: JSON.stringify({ message: question, group_id: groupId, history: history.slice(0, -1) }),
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

  // Drag-Handling für den Button
  function onPointerDown(e) {
    const d = dragRef.current;
    d.dragging = true; d.moved = false;
    d.startX = e.clientX; d.startY = e.clientY;
    d.origX = pos.x; d.origY = pos.y;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    // x von rechts, y von unten gerechnet
    const newX = Math.max(8, d.origX - dx);
    const newY = Math.max(8, d.origY - dy);
    setPos({ x: newX, y: newY });
  }
  function onPointerUp() {
    const d = dragRef.current;
    d.dragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    localStorage.setItem("lendapp_chat_pos", JSON.stringify(pos));
    // Wenn nicht bewegt → als Klick werten
    if (!d.moved) setOpen(o => !o);
  }

  if (!groupId) return null;

  return (
    <>
      {open && (
        <div style={{
          position: "fixed", bottom: pos.y + 60, right: pos.x, width: 340,
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", zIndex: 200, maxHeight: "70vh",
        }}>
          <div style={{ background: "#1C1A16", borderRadius: "16px 16px 0 0", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ color: "#7CFF6B", fontWeight: 600, fontSize: 14 }}>Lendapp AI</div>
                <div style={{ color: "#666", fontSize: 10 }}>
                  {status?.ollama === "online" ? <span style={{ color: "#7CFF6B" }}>● online</span>
                    : status?.ollama === "offline" ? <span style={{ color: "#FF6B6B" }}>● offline</span>
                    : "Verbinde…"}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%", padding: "9px 13px",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? "#2D5016" : m.error ? "#FAEBD7" : "var(--bg2)",
                  color: m.role === "user" ? "#fff" : m.error ? "#854F0B" : "var(--text)",
                  fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
                }}>
                  {m.role === "assistant" ? renderText(m.text, handleLinkClick) : m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "var(--bg2)", borderRadius: "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: "var(--text3)" }}>●●●</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && (
            <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Was ist verfügbar?", "Was kann ich diese Woche leihen?", "Hast du Werkzeug?"].map(s => (
                <button key={s} onClick={() => handleSend(s)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Frage stellen…"
              disabled={loading || status?.ollama === "offline"}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)", fontSize: 13, outline: "none" }}
            />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()}
              style={{ background: "#2D5016", border: "none", borderRadius: 10, color: "#fff", width: 36, cursor: "pointer", fontSize: 16 }}>→</button>
          </div>
        </div>
      )}

      {/* Verschiebbarer Button */}
      <button
        onPointerDown={onPointerDown}
        style={{
          position: "fixed", bottom: pos.y, right: pos.x,
          width: 52, height: 52, borderRadius: "50%",
          background: open ? "#1C1A16" : "#2D5016",
          border: "none", color: "#fff", fontSize: 22,
          cursor: "grab", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          zIndex: 201, touchAction: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        title="Ziehen zum Verschieben, klicken zum Öffnen"
      >
        {open ? "✕" : "🤖"}
      </button>
    </>
  );
}
