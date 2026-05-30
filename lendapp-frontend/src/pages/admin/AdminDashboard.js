import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../api/client";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.adminStats(user.user_id).then(setStats).catch(() => {});
  }, [user]);

  const cards = stats ? [
    { label: "User total",    val: stats.users,          icon: "👤", color: "#E0EAF5" },
    { label: "Aktive User",   val: stats.active_users,   icon: "✅", color: "#EAF0E0" },
    { label: "Gesperrte User",val: stats.inactive_users, icon: "🔒", color: "#FAEBD7" },
    { label: "Gruppen",       val: stats.groups,         icon: "👥", color: "#EEEDFE" },
    { label: "Artikel",       val: stats.items,          icon: "📦", color: "#E0EAF5" },
    { label: "Buchungen",     val: stats.bookings,       icon: "📋", color: "#EAF0E0" },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Übersicht aller Daten</div>
      </div>
      {!stats ? (
        <div style={{ color: "var(--text3)" }}>Lädt…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
          {cards.map(c => (
            <div key={c.label} className="card" style={{ background: c.color, border: "none" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "monospace" }}>{c.val}</div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
