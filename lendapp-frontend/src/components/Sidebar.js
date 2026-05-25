import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const CATEGORY_EMOJI = {
  Werkzeug: "🔧", Sport: "🏕️", Haushalt: "🏠", Elektronik: "📱", Sonstiges: "📦"
};
export { CATEGORY_EMOJI };

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const links = [
    { path: "/",         label: "Übersicht",   icon: "🏠" },
    { path: "/items",    label: "Gegenstände", icon: "📦" },
    { path: "/bookings", label: "Anfragen",    icon: "📋" },
    { path: "/group",    label: "Gruppe",      icon: "👥" },
  ];

  return (
    <div className="sidebar">
      <div className="logo">
        <div className="logo-dot" />
        LendApp
      </div>
      <nav>
        {links.map(l => (
          <div key={l.path}
            className={`nav-item ${pathname === l.path ? "active" : ""}`}
            onClick={() => navigate(l.path)}>
            <span className="nav-icon">{l.icon}</span>
            {l.label}
          </div>
        ))}
        {user?.is_admin && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />
            <div className={`nav-item ${pathname.startsWith("/admin") ? "active" : ""}`}
              onClick={() => navigate("/admin")}
              style={{ color: "var(--warn)" }}>
              <span className="nav-icon">⚙️</span>
              Admin
            </div>
          </>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-chip">
          <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>ID #{user?.user_id}</div>
          </div>
          <span style={{ cursor: "pointer", fontSize: 16 }} onClick={logout} title="Logout">↩</span>
        </div>
      </div>
    </div>
  );
}
