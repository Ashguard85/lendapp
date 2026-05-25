import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!user?.is_admin) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="card" style={{ maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Kein Zugriff</div>
        <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 16 }}>Du hast keine Admin-Rechte.</p>
        <button className="btn btn-secondary" onClick={() => navigate("/")}>Zurück zur App</button>
      </div>
    </div>
  );

  const links = [
    { path: "/admin",        label: "Dashboard", icon: "📊" },
    { path: "/admin/users",  label: "User",      icon: "👤" },
    { path: "/admin/groups", label: "Gruppen",   icon: "👥" },
    { path: "/admin/items",  label: "Artikel",   icon: "📦" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Admin Sidebar */}
      <div style={{ width: 220, background: "#1C1A16", display: "flex", flexDirection: "column", padding: "24px 16px", flexShrink: 0 }}>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 16, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚙️</span> Admin
        </div>
        <div style={{ color: "#9E9B94", fontSize: 12, marginBottom: 28 }}>LendApp</div>
        <nav style={{ flex: 1 }}>
          {links.map(l => (
            <div key={l.path}
              onClick={() => navigate(l.path)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                marginBottom: 2, fontSize: 14, fontWeight: 500,
                background: pathname === l.path ? "rgba(255,255,255,0.1)" : "transparent",
                color: pathname === l.path ? "#fff" : "#9E9B94",
                transition: "all 0.15s",
              }}
            >
              <span>{l.icon}</span>{l.label}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
          <div style={{ color: "#9E9B94", fontSize: 12, marginBottom: 10 }}>{user.name}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => navigate("/")}
              style={{ flex: 1, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "#fff", padding: "7px 10px", fontSize: 12, cursor: "pointer" }}>
              ← App
            </button>
            <button onClick={logout}
              style={{ flex: 1, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "#fff", padding: "7px 10px", fontSize: 12, cursor: "pointer" }}>
              Logout
            </button>
          </div>
        </div>
      </div>
      {/* Content */}
      <main style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
