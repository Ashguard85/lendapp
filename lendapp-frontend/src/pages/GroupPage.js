import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/client";

export default function GroupPage() {
  const { user, groupId, setGroup, logout } = useAuth();
  const [group, setGroupData] = useState(null);
  const [members, setMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    api.getGroup(groupId).then(setGroupData).catch(() => {});
    api.getMembers(groupId).then(setMembers).catch(() => {});
  }, [groupId]);

  async function handleCreate() {
    if (!newGroupName.trim()) return setError("Name eingeben");
    setLoading(true); setError("");
    try {
      const g = await api.createGroup({ name: newGroupName }, user.user_id);
      setGroup(g.id);
      setGroupData(g);
      setSuccess(`Gruppe „${g.name}" erstellt! Code: ${g.invite_code}`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!joinId || !joinCode) return setError("Gruppen-ID und Code eingeben");
    setLoading(true); setError("");
    try {
      const res = await api.joinGroup(joinId, joinCode, user.user_id);
      setGroup(joinId);
      setSuccess(res.message);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function copyInvite() {
    if (group) {
      navigator.clipboard.writeText(`Gruppen-ID: ${group.id} | Code: ${group.invite_code}`);
      setSuccess("Kopiert!");
      setTimeout(() => setSuccess(""), 2000);
    }
  }

  if (!groupId) return (
    <div>
      <div className="page-header">
        <div className="page-title">Gruppe</div>
        <div className="page-sub">Erstelle eine Gruppe oder tritt einer bei</div>
      </div>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>🆕 Neue Gruppe erstellen</div>
          <div className="form-group">
            <label className="form-label">Gruppenname</label>
            <input className="form-input" placeholder="z.B. Familie Müller"
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
          </div>
          {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          {success && <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 10, background: "var(--accent-light)", padding: "8px 12px", borderRadius: "var(--radius-sm)" }}>{success}</div>}
          <button className="btn btn-primary btn-full" onClick={handleCreate} disabled={loading}>
            {loading ? "…" : "Gruppe erstellen"}
          </button>
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>🔗 Gruppe beitreten</div>
          <div className="form-group">
            <label className="form-label">Gruppen-ID</label>
            <input className="form-input" placeholder="z.B. 1" type="number"
              value={joinId} onChange={e => setJoinId(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Einladungscode</label>
            <input className="form-input" placeholder="z.B. abc123"
              value={joinCode} onChange={e => setJoinCode(e.target.value)} />
          </div>
          {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          {success && <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 10 }}>{success}</div>}
          <button className="btn btn-secondary btn-full" onClick={handleJoin} disabled={loading}>
            {loading ? "…" : "Beitreten"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Gruppe</div>
        {group && <div className="page-sub">{group.name}</div>}
      </div>
      {group && (
        <div className="card" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{group.name}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
              ID: <strong>{group.id}</strong> · Code: <strong>{group.invite_code}</strong>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={copyInvite}>📋 Einladung kopieren</button>
        </div>
      )}
      {success && (
        <div style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 16 }}>
          {success}
        </div>
      )}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>👥 Mitglieder ({members.length})</div>
        {members.map(m => (
          <div key={m.user_id} className="booking-row">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="avatar avatar-lg">{m.name?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>{m.email}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {m.is_admin && <span className="badge badge-green">Admin</span>}
              {m.user_id === user.user_id && <span className="badge badge-blue">Du</span>}
            </div>
          </div>
        ))}
        {members.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>Keine Mitglieder geladen.</div>}
      </div>
      <button className="btn btn-danger btn-sm" onClick={logout}>↩ Ausloggen</button>
    </div>
  );
}
