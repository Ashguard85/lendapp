import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CATEGORY_EMOJI } from "../components/Sidebar";
import * as api from "../api/client";

function fmt(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function HomePage() {
  const { user, groups, groupIds } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadAll() {
    if (!groupIds || groupIds.length === 0) return setLoading(false);
    Promise.all([
      Promise.all(groupIds.map(gid =>
        api.getItems(gid, user.user_id).then(its =>
          its.map(i => ({ ...i, _groupName: (groups.find(g => g.id === gid) || {}).name }))
        )
      )).then(all => all.reduce((a, b) => a.concat(b), [])),
      api.getPendingForOwner(user.user_id),
      api.getBookingsForUser(user.user_id),
    ]).then(([its, pnd, bks]) => {
      setItems(its);
      setPending(pnd);
      setMyBookings(bks);
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(loadAll, [groupIds.join(","), user.user_id]);

  async function handleStatus(bookingId, status) {
    await api.updateBookingStatus(bookingId, status, user.user_id);
    loadAll();
  }

  if (!groupIds || groupIds.length === 0) return (
    <div>
      <div className="page-header">
        <div className="page-title">Willkommen, {user && user.name}!</div>
        <div className="page-sub">Erstelle oder tritt einer Gruppe bei.</div>
      </div>
      <div className="card" style={{ maxWidth: 400 }}>
        <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 16 }}>Du bist noch in keiner Gruppe.</p>
        <button className="btn btn-primary" onClick={() => navigate("/group")}>Zur Gruppe</button>
      </div>
    </div>
  );

  const available = items.filter(i => i.is_available);
  const myItems = items.filter(i => i.owner_id === user.user_id);
  const lentOut = items.filter(i => !i.is_available && i.owner_id === user.user_id);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Ubersicht</div>
        <div className="page-sub">Hallo {user && user.name}! {groups.length} Gruppe{groups.length !== 1 ? "n" : ""}</div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-val">{items.length}</div><div className="stat-label">Gegenstande total</div></div>
        <div className="stat-card"><div className="stat-val">{available.length}</div><div className="stat-label">Verfugbar</div></div>
        <div className="stat-card"><div className="stat-val">{myItems.length}</div><div className="stat-label">Meine Dinge</div></div>
        <div className="stat-card">
          <div className="stat-val" style={{ color: pending.length > 0 ? "var(--warn)" : "var(--text)" }}>{pending.length}</div>
          <div className="stat-label">Offene Anfragen</div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "3px solid var(--warn)" }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Jemand mochte etwas von dir ausleihen</div>
          {pending.map(b => (
            <div key={b.id} className="booking-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}><strong>{b.borrower_name}</strong> - <strong>{b.item_name}</strong></div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{fmt(b.date_from)} - {fmt(b.date_to)}</div>
                {b.note && <div style={{ fontSize: 12, color: "var(--text2)", fontStyle: "italic" }}>{b.note}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn btn-sm" style={{ background: "var(--accent-light)", color: "var(--accent)", border: "none" }} onClick={() => handleStatus(b.id, "approved")}>Ja</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleStatus(b.id, "rejected")}>Nein</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lentOut.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "3px solid var(--blue)" }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Von dir ausgeliehen</div>
          {lentOut.map(item => {
            const active = myBookings.find(b => b.item_id === item.id && b.status === "approved");
            return (
              <div key={item.id} className="booking-row" style={{ cursor: "pointer" }} onClick={() => navigate("/items/" + item.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 24 }}>{CATEGORY_EMOJI[item.category] || "📦"}</div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                    {active && <div style={{ fontSize: 12, color: "var(--text3)" }}>Bei: <strong>{active.borrower_name}</strong> bis {fmt(active.date_to)}</div>}
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{item._groupName}</div>
                  </div>
                </div>
                <span className="badge badge-orange">ausgeliehen</span>
              </div>
            );
          })}
        </div>
      )}

      {myBookings.filter(b => b.status === "approved").length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "3px solid var(--accent)" }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Ich habe ausgeliehen</div>
          {myBookings.filter(b => b.status === "approved").map(b => (
            <div key={b.id} className="booking-row">
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{b.item_name}</div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>Von: <strong>{b.owner_name}</strong> bis {fmt(b.date_to)}</div>
              </div>
              <span className="badge badge-green">aktiv</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontWeight: 600 }}>Alle Gegenstande</div>
        <button className="btn btn-sm btn-secondary" onClick={() => navigate("/items")}>Alle anzeigen</button>
      </div>

      {loading ? <div style={{ color: "var(--text3)" }}>Ladt...</div> : (
        <div className="card-grid">
          {items.slice(0, 6).map(item => (
            <div key={item.id} className="item-card" onClick={() => navigate("/items/" + item.id)}>
              {item.thumb_url ? (
                <div style={{ width: "100%", height: 100, borderRadius: 8, overflow: "hidden", position: "relative", background: "#000" }}>
                  <img src={item.thumb_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(12px)", transform: "scale(1.1)", opacity: 0.7 }} />
                  <img src={item.thumb_url} alt={item.name} style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", zIndex: 1 }} />
                </div>
              ) : (
                <div className="item-emoji">{CATEGORY_EMOJI[item.category] || "📦"}</div>
              )}
              <div>
                <div className="item-name">{item.name}</div>
                <div className="item-meta">{item.category} - {item._groupName}</div>
              </div>
              <span className={"badge " + (item.is_available ? "badge-green" : "badge-orange")}>
                {item.is_available ? "verfugbar" : "ausgeliehen"}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <div className="empty" style={{ gridColumn: "1/-1" }}>
              <div className="empty-icon">📦</div>
              <div className="empty-text">Noch keine Gegenstande.</div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate("/items")}>Ersten erfassen</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
