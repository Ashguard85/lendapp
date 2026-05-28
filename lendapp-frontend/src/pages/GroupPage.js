import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/client";

export default function GroupPage() {
  const { user, groupId, groups, setGroup, addGroup, logout } = useAuth();
  const [group, setGroupData] = useState(null);
  const [members, setMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("info"); // info | create | join

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
      addGroup({ id: g.id, name: g.name });
      setGroup(g.id);
      setGroupData(g);
      setSuccess(`Gruppe „${g.name}" erstellt! Code: ${g.invite_code}`);
      setTab("info");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!joinId || !joinCode) return setError("Gruppen-ID und Code eingeben");
    setLoading(true); setError("");
    try {
      const res = await api.joinGroup(joinId, joinCode, user.user_id);
      addGroup({ id: parseInt(joinId), name: res.group_name || `Gruppe ${joinId}` });
      setGroup(joinId);
      setSuccess(res.message);
      setTab("info");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function copyInvite() {
    if (group) {
      navigator.clipboard.writeText(`Gruppen-ID: ${group.id} | Code: ${group.invite_code}`);
      setSuccess("Kopiert!"); setTimeout(() => setSuccess(""), 2000);
    }
  }

  const tabStyle = (t) => ({
    flex: 1, padding: "8px 0", textAlign: "center", fontSize: 13,
    fontWeight: 500, cursor: "pointer", borderRadius: 8,
    background: tab === t ? "var(--card)" : "transparent",
    color: tab === t ? "var(--text)" : "var(--text3)",
    border: "none",
  });

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Gruppen</div>
          <div className="page-sub">{groups.length} Gruppe{groups.length !== 1 ? "n" : ""}</div>
        </div>
      </div>

      {/* Alle Gruppen des Users */}
      {groups.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Meine Gruppen</div>
          {groups.map(g => (
            <div key={g.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0", borderBottom: "1px solid var(--border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: g.id === groupId ? "var(--accent-mid)" : "var(--border)" }} />
                <span style={{ fontWeight: g.id === groupId ? 600 : 400, fontSize: 14 }}>{g.name}</span>
                {g.id === groupId && <span className="badge badge-green" style={{ fontSize: 10 }}>aktiv</span>}
              </div>
              {g.id !== groupId && (
                <button className="btn btn-sm btn-secondary" onClick={() => setGroup(g.id)}>Wechseln</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", background: "var(--bg2)", borderRadius: 10, padding: 4, marginBottom: 20, gap: 4 }}>
        <button style={tabStyle("info")} onClick={() => setTab("info")}>ℹ️ Info</button>
        <button style={tabStyle("create")} onClick={() => setTab("create")}>🆕 Erstellen</button>
        <button style={tabStyle("join")} onClick={() => setTab("join")}>🔗 Beitreten</button>
      </div>

      {success && (
        <div style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 16 }}>{success}</div>
      )}

      {/* Tab: Info */}
      {tab === "info" && groupId && group && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{group.name}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
                  ID: <strong>{group.id}</strong> · Code: <strong>{group.invite_code}</strong>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={copyInvite}>📋 Einladung kopieren</button>
            </div>
          </div>
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
                <div style={{ display: "flex", gap: 8 }}>
                  {m.is_admin && <span className="badge badge-green">Admin</span>}
                  {m.user_id === user.user_id && <span className="badge badge-blue">Du</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "info" && !groupId && (
        <div className="card">
          <p style={{ fontSize: 14, color: "var(--text2)" }}>Du bist noch in keiner Gruppe. Erstelle eine oder tritt einer bei.</p>
        </div>
      )}

      {/* Tab: Erstellen */}
      {tab === "create" && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>🆕 Neue Gruppe erstellen</div>
          <div className="form-group">
            <label className="form-label">Gruppenname</label>
            <input className="form-input" placeholder="z.B. Familie Müller" value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)} />
          </div>
          {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button className="btn btn-primary btn-full" onClick={handleCreate} disabled={loading}>
            {loading ? "…" : "Gruppe erstellen"}
          </button>
        </div>
      )}

      {/* Tab: Beitreten */}
      {tab === "join" && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>🔗 Gruppe beitreten</div>
          <div className="form-group">
            <label className="form-label">Gruppen-ID</label>
            <input className="form-input" placeholder="z.B. 1" type="number" value={joinId}
              onChange={e => setJoinId(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Einladungscode</label>
            <input className="form-input" placeholder="z.B. abc123" value={joinCode}
              onChange={e => setJoinCode(e.target.value)} />
          </div>
          {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button className="btn btn-secondary btn-full" onClick={handleJoin} disabled={loading}>
            {loading ? "…" : "Beitreten"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-danger btn-sm" onClick={logout}>↩ Ausloggen</button>
      </div>
    </div>
  );
}
