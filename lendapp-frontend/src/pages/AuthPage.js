const [groupId, setGroupId] = useState(() => {
  const val = localStorage.getItem("lendapp_group");
  if (val) {
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  }
  // Fallback: aus user Objekt lesen
  try {
    const u = JSON.parse(localStorage.getItem("lendapp_user"));
    return u?.group_id || null;
  } catch { return null; }
});
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/client";

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "register") {
        await api.register(form);
        setMode("login");
        setError("✓ Konto erstellt – bitte einloggen");
      } else {
        const data = await api.login(form.email, form.password);
        login(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔧</div>
        <div className="auth-title">LendApp</div>
        <div className="auth-sub">
          {mode === "login" ? "Willkommen zurück!" : "Neues Konto erstellen"}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="Dein Name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">E-Mail</label>
            <input className="form-input" type="email" placeholder="du@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Passwort</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: error.startsWith("✓") ? "var(--accent)" : "var(--warn)", marginBottom: 14, padding: "8px 12px", background: error.startsWith("✓") ? "var(--accent-light)" : "var(--warn-light)", borderRadius: "var(--radius-sm)" }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Einloggen" : "Konto erstellen"}
          </button>
        </form>

        <div className="divider" />
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--text2)" }}>
          {mode === "login" ? "Noch kein Konto? " : "Bereits registriert? "}
          <span style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 500 }}
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Registrieren" : "Einloggen"}
          </span>
        </div>
      </div>
    </div>
  );
}
