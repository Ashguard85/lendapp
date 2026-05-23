import { useNavigate, useLocation } from "react-router-dom";

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const links = [
    { path: "/",         label: "Home",     icon: "🏠" },
    { path: "/items",    label: "Dinge",    icon: "📦" },
    { path: "/bookings", label: "Anfragen", icon: "📋" },
    { path: "/group",    label: "Gruppe",   icon: "👥" },
  ];

  return (
    <nav className="bottom-nav">
      {links.map(l => (
        <div
          key={l.path}
          className={`bottom-nav-item ${pathname === l.path ? "active" : ""}`}
          onClick={() => navigate(l.path)}
        >
          <span className="bottom-nav-icon">{l.icon}</span>
          <span className="bottom-nav-label">{l.label}</span>
        </div>
      ))}
    </nav>
  );
}
