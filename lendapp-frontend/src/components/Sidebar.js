import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const CATEGORY_EMOJI = {
  Werkzeug: "🔧", Sport: "🏕️", Haushalt: "🏠", Elektronik: "📱", Sonstiges: "📦"
};
export { CATEGORY_EMOJI };

export default function Sidebar() {
  const { user, groups, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const links = [
    { path: "/",         label: "Ubersicht",   icon: "🏠" },
    { path: "/items",    label: "Gegenstande", icon: "📦" },
    { path: "/bookings", label: "Anfragen",    icon: "📋" },
    { path: "/group",    label: "Gruppen",     icon: "👥" },
  ];

  return (
    <div className="sidebar">
      <div className="logo">
        <div className="logo-dot" />
        Lendapp
      </div>
      <nav>
        {links.map(l => (
          <div key={l.path}
            className={`nav-item ${pathname === l.path ? "active" : ""}`}
            onClick={() => navigate(l.path)}>
            <span className="nav-icon">{l.icon}</span>
            {l.label}
            {l.path === "/group" && groups.length > 1 && (
              <span style={{ marginLeft: "auto", background: "var(--accent-light)", color: "var(--accent)", borderRadius: 20, fontSize: 10, padding: "1px 7px", fontWeight: 600 }}>
                {groups.length}
              </span>
            )}
          </div>
        ))}
        {user && user.is_admin && (
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
          <div className="avatar">{user && user.name ? user.name[0].toUpperCase() : "?"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user && user.name}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              {groups.length} Gruppe{groups.length !== 1 ? "n" : ""}
            </div>
          </div>
          <span style={{ cursor: "pointer", fontSize: 16 }} onClick={logout} title="Logout">↩</span>
        </div>
      </div>
    </div>
  );
}
