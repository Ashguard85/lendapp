import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CATEGORY_EMOJI } from "../components/Sidebar";
import * as api from "../api/client";

export default function HomePage() {
  const { user, groupId } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return setLoading(false);
    Promise.all([
      api.getItems(groupId, user.user_id),
      api.getBookingsForUser(user.user_id),
    ]).then(([its, bks]) => { setItems(its); setBookings(bks); })
      .finally(() => setLoading(false));
  }, [groupId, user]);

  if (!groupId) return (
    <div>
      <div className="page-header">
        <div className="page-title">Willkommen, {user?.name}! 👋</div>
        <div className="page-sub">Erstelle oder tritt einer Gruppe bei, um loszulegen.</div>
      </div>
      <div className="card" style={{ maxWidth: 400 }}>
        <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 16 }}>Du bist noch in keiner Gruppe. Geh zu <strong>Gruppe</strong> um eine zu erstellen oder beizutreten.</p>
        <button className="btn btn-primary" onClick={() => navigate("/group")}>Zur Gruppe →</button>
      </div>
    </div>
  );

  const available = items.filter(i => i.is_available);
  const myItems = items.filter(i => i.owner_id === user.user_id);
  const pending = bookings.filter(b => b.status === "pending");

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Übersicht</div>
        <div className="page-sub">Was gibt's Neues in deiner Gruppe?</div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-val">{items.length}</div>
          <div className="stat-label">Gegenstände total</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{available.length}</div>
          <div className="stat-label">Verfügbar</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{myItems.length}</div>
          <div className="stat-label">Meine Dinge</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{pending.length}</div>
          <div className="stat-label">Offene Anfragen</div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "3px solid var(--warn)" }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>⏳ Offene Buchungsanfragen</div>
          {pending.slice(0, 3).map(b => (
            <div key={b.id} className="booking-row">
              <span style={{ fontSize: 13 }}>Buchung #{b.id} · Item #{b.item_id}</span>
              <span className="badge badge-orange">ausstehend</span>
            </div>
          ))}
          <button className="btn btn-sm btn-secondary" style={{ marginTop: 12 }} onClick={() => navigate("/bookings")}>Alle anzeigen</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontWeight: 600 }}>Zuletzt hinzugefügt</div>
        <button className="btn btn-sm btn-secondary" onClick={() => navigate("/items")}>Alle anzeigen</button>
      </div>

      {loading ? <div style={{ color: "var(--text3)" }}>Lädt…</div> : (
        <div className="card-grid">
          {items.slice(0, 6).map(item => (
            <div key={item.id} className="item-card" onClick={() => navigate(`/items/${item.id}`)}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="item-emoji">{CATEGORY_EMOJI[item.category] || "📦"}</div>
                <div>
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">{item.category}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={`badge ${item.is_available ? "badge-green" : "badge-orange"}`}>
                  {item.is_available ? "✓ verfügbar" : "ausgeliehen"}
                </span>
                <span className="tag">max. {item.max_days}d</span>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="empty" style={{ gridColumn: "1/-1" }}>
              <div className="empty-icon">📦</div>
              <div className="empty-text">Noch keine Gegenstände.</div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate("/items")}>Ersten erfassen</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
