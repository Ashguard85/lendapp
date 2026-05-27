import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../api/client";

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", is_admin: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.adminListUsers(user.user_id).then(setUsers).finally(() => setLoading(false));
  }
  useEffect(load, [user]);

  async function handleCreate() {
    if (!form.name || !form.email || !form.password) return setError("Alle Felder ausfüllen");
    setSaving(true);
    try {
      await api.adminCreateUser(form, user.user_id);
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", is_admin: false });
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(u) {
    await api.adminUpdateUser(u.id, { is_active: !u.is_active }, user.user_id);
    load();
  }

  async function toggleAdmin(u) {
    await api.adminUpdateUser(u.id, { is_admin: !u.is_admin }, user.user_id);
    load();
  }

  async function handleDelete(u) {
    if (!window.confirm(`User „${u.name}" wirklich löschen?`)) return;
    await api.adminDeleteUser(u.id, user.user_id);
    load();
  }

  async function handleResetPw() {
    if (!newPw) return;
    await api.adminResetPw(resetUser.id, newPw, user.user_id);
    setResetUser(null);
    setNewPw("");
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">User</div>
          <div className="page-sub">{users.length} registrierte Nutzer</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setError(""); }}>+ User erstellen</button>
      </div>

      {loading ? <div style={{ color: "var(--text3)" }}>Lädt…</div> : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text3)", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>ID</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Name</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>E-Mail</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Rolle</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Artikel</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)", opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 12px", color: "var(--text3)", fontFamily: "monospace" }}>#{u.id}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{u.email}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={`badge ${u.is_active ? "badge-green" : "badge-gray"}`}>
                      {u.is_active ? "aktiv" : "gesperrt"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={`badge ${u.is_admin ? "badge-orange" : "badge-blue"}`}>
                      {u.is_admin ? "admin" : "user"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{u.item_count}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => toggleActive(u)}
                        title={u.is_active ? "Sperren" : "Aktivieren"}>
                        {u.is_active ? "🔒" : "✅"}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => toggleAdmin(u)}
                        title={u.is_admin ? "Admin entfernen" : "Zum Admin machen"}>
                        {u.is_admin ? "👤" : "⭐"}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setResetUser(u); setNewPw(""); }}
                        title="Passwort zurücksetzen">🔑</button>
                      {u.id !== user.user_id && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)}
                          title="Löschen">🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="👤 User erstellen" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">E-Mail</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Passwort</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <input type="checkbox" id="isadmin" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
            <label htmlFor="isadmin" style={{ fontSize: 14 }}>Admin-Rechte vergeben</label>
          </div>
          {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate} disabled={saving}>{saving ? "…" : "Erstellen"}</button>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      {resetUser && (
        <Modal title={`🔑 PW zurücksetzen: ${resetUser.name}`} onClose={() => setResetUser(null)}>
          <div className="form-group">
            <label className="form-label">Neues Passwort</label>
            <input className="form-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleResetPw}>Zurücksetzen</button>
            <button className="btn btn-secondary" onClick={() => setResetUser(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
