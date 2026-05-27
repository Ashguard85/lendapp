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

export default function AdminGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.adminListGroups(user.user_id).then(setGroups).finally(() => setLoading(false));
  }
  useEffect(load, [user]);

  async function handleCreate() {
    if (!name.trim()) return setError("Name eingeben");
    setSaving(true);
    try {
      await api.adminCreateGroup({ name }, user.user_id);
      setShowCreate(false); setName(""); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!name.trim()) return setError("Name eingeben");
    setSaving(true);
    try {
      await api.adminUpdateGroup(editGroup.id, { name }, user.user_id);
      setEditGroup(null); setName(""); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(g) {
    if (!window.confirm(`Gruppe „${g.name}" wirklich löschen?`)) return;
    await api.adminDeleteGroup(g.id, user.user_id);
    load();
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Gruppen</div>
          <div className="page-sub">{groups.length} Gruppen</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setName(""); setError(""); }}>+ Gruppe erstellen</button>
      </div>

      {loading ? <div style={{ color: "var(--text3)" }}>Lädt…</div> : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text3)", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>ID</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Name</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Einladungscode</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Mitglieder</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Artikel</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", color: "var(--text3)", fontFamily: "monospace" }}>#{g.id}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{g.name}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "var(--text2)", fontSize: 12 }}>{g.invite_code}</td>
                  <td style={{ padding: "10px 12px" }}><span className="badge badge-blue">{g.member_count}</span></td>
                  <td style={{ padding: "10px 12px" }}><span className="badge badge-green">{g.item_count}</span></td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setEditGroup(g); setName(g.name); setError(""); }}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showCreate || editGroup) && (
        <Modal title={editGroup ? "✏️ Gruppe bearbeiten" : "👥 Gruppe erstellen"}
          onClose={() => { setShowCreate(false); setEditGroup(null); }}>
          <div className="form-group">
            <label className="form-label">Gruppenname</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }}
              onClick={editGroup ? handleUpdate : handleCreate} disabled={saving}>
              {saving ? "…" : editGroup ? "Speichern" : "Erstellen"}
            </button>
            <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setEditGroup(null); }}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
