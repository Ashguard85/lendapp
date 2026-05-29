import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/client";

export default function GroupPage() {
  const { user, groups, addGroup, removeGroup, logout } = useAuth();
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState({});
  const [members, setMembers] = useState({});
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("list");

  async function loadGroupDetails(groupId) {
    if (groupDetails[groupId] && members[groupId]) return;
    try {
      const [g, m] = await Promise.all([
        api.getGroup(groupId),
        api.getMembers(groupId),
      ]);
      setGroupDetails(prev => ({ ...prev, [groupId]: g }));
      setMembers(prev => ({ ...prev, [groupId]: m }));
    } catch (e) {}
  }

  function toggleGroup(id) {
    if (expandedGroup === id) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(id);
      loadGroupDetails(id);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return setError("Name eingeben");
    setLoading(true); setError("");
    try {
      const g = await api.createGroup({ name: newName }, user.user_id);
      addGroup({ id: g.id, name: g.name });
      setGroupDetails(prev => ({ ...prev, [g.id]: g }));
      setNewName("");
      setSuccess("Gruppe " + g.name + " erstellt!");
      setTab("list");
      setExpandedGroup(g.id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return setError("Code eingeben");
    setLoading(true); setError("");
    try {
      const res = await api.joinGroup(joinCode.trim(), user.user_id);
      addGroup({ id: res.group_id, name: res.group_name });
      setJoinCode("");
      setSuccess("Willkommen in " + res.group_name + "!");
      setTab("list");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleLeave(group) {
    if (!window.confirm("Gruppe " + group.name + " wirklich verlassen?")) return;
    try {
      await api.leaveGroup(group.id, user.user_id);
      removeGroup(group.id);
      setExpandedGroup(null);
      setSuccess("Gruppe verlassen.");
    } catch (e) { setError(e.message); }
  }

  function copyCode(code) {
    // Fallback fuer HTTP (kein HTTPS = kein clipboard API)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(() => {
          setSuccess("Code kopiert: " + code);
          setTimeout(() => setSuccess(""), 3000);
        });
      } else {
        const el = document.createElement("textarea");
        el.value = code;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setSuccess("Code kopiert: " + code);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (e) {
      setSuccess("Code: " + code + " (bitte manuell kopieren)");
      setTimeout(() => setSuccess(""), 6000);
    }
  }

  const tabStyle = (t) => ({
    flex: 1, padding: "8px 0", textAlign: "center", fontSize: 13,
    fontWeight: 500, cursor: "pointer", borderRadius: 8,
    background: tab === t ? "var(--card)" : "transparent",
    color: tab === t ? "var(--text)" : "var(--text3)", border: "none",
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Gruppen</div>
        <div className="page-sub">{groups.length} Gruppe{groups.length !== 1 ? "n" : ""}</div>
      </div>

      <div style={{ display: "flex", background: "var(--bg2)", borderRadius: 10, padding: 4, marginBottom: 20, gap: 4 }}>
        <button style={tabStyle("list")} onClick={() => setTab("list")}>Meine Gruppen</button>
        <button style={tabStyle("create")} onClick={() => setTab("create")}>Erstellen</button>
        <button style={tabStyle("join")} onClick={() => setTab("join")}>Beitreten</button>
      </div>

      {success && (
        <div style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 16 }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{ background: "var(--warn-light)", color: "var(--warn)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {tab === "list" && (
        <div>
          {groups.length === 0 && (
            <div className="card">
              <p style={{ fontSize: 14, color: "var(--text2)" }}>Du bist noch in keiner Gruppe. Erstelle eine oder tritt einer bei.</p>
            </div>
          )}
          {groups.map(g => {
            const detail = groupDetails[g.id];
            const groupMembers = members[g.id];
            const isExpanded = expandedGroup === g.id;

            return (
              <div key={g.id} className="card" style={{ marginBottom: 12 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                  onClick={() => toggleGroup(g.id)}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-mid)", marginRight: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</div>
                    {g.is_admin && <span className="badge badge-green" style={{ fontSize: 10 }}>Admin</span>}
                  </div>
                  <span style={{ color: "var(--text3)", fontSize: 12, marginLeft: 8 }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>

                {/* Details */}
                {isExpanded && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>

                    {/* Einladungscode */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Einladungscode
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg2)", borderRadius: 8, padding: "10px 14px" }}>
                          <div style={{ flex: 1, fontWeight: 700, fontSize: 18, letterSpacing: "0.1em", fontFamily: "monospace", color: detail ? "var(--text)" : "var(--text3)" }}>
                            {detail ? detail.invite_code : "Ladt..."}
                          </div>
                          {detail && detail.invite_code && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={e => { e.stopPropagation(); e.preventDefault(); copyCode(detail.invite_code); }}>
                              Kopieren
                            </button>
                          )}
                        </div>
                    </div>

                    {/* Mitglieder */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Mitglieder {groupMembers ? "(" + groupMembers.length + ")" : ""}
                      </div>
                      {groupMembers ? groupMembers.map(m => (
                        <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                          <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                            {m.name && m.name[0] ? m.name[0].toUpperCase() : "?"}
                          </div>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                          {m.is_admin && <span className="badge badge-green" style={{ fontSize: 10 }}>Admin</span>}
                          {m.user_id === user.user_id && <span className="badge badge-blue" style={{ fontSize: 10 }}>Du</span>}
                        </div>
                      )) : (
                        <div style={{ color: "var(--text3)", fontSize: 13 }}>Ladt...</div>
                      )}
                    </div>

                    {/* Austreten */}
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ width: "100%" }}
                      onClick={e => { e.stopPropagation(); handleLeave(g); }}>
                      Gruppe verlassen
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-danger btn-sm" onClick={logout}>Ausloggen</button>
          </div>
        </div>
      )}

      {tab === "create" && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Neue Gruppe erstellen</div>
          <div className="form-group">
            <label className="form-label">Gruppenname</label>
            <input className="form-input" placeholder="z.B. Familie Muller" value={newName}
              onChange={e => setNewName(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-full" onClick={handleCreate} disabled={loading}>
            {loading ? "..." : "Gruppe erstellen"}
          </button>
        </div>
      )}

      {tab === "join" && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Gruppe beitreten</div>
          <div className="form-group">
            <label className="form-label">Einladungscode</label>
            <input className="form-input" placeholder="z.B. abc12345" value={joinCode}
              onChange={e => setJoinCode(e.target.value)} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>
            Den Code bekommst du vom Gruppenadmin.
          </p>
          <button className="btn btn-secondary btn-full" onClick={handleJoin} disabled={loading}>
            {loading ? "..." : "Beitreten"}
          </button>
        </div>
      )}
    </div>
  );
}
