import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lendapp_user")); } catch { return null; }
  });
  const [groupId, setGroupId] = useState(() => {
    const val = localStorage.getItem("lendapp_group");
    if (val) { const n = parseInt(val, 10); return isNaN(n) ? null : n; }
    try {
      const u = JSON.parse(localStorage.getItem("lendapp_user"));
      return u?.group_id || null;
    } catch { return null; }
  });
  const [groups, setGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lendapp_groups")) || []; } catch { return []; }
  });

  function login(userData) {
    localStorage.setItem("lendapp_user", JSON.stringify(userData));
    setUser(userData);
    if (userData.groups?.length) {
      localStorage.setItem("lendapp_groups", JSON.stringify(userData.groups));
      setGroups(userData.groups);
    }
    if (userData.group_id) {
      localStorage.setItem("lendapp_group", String(userData.group_id));
      setGroupId(userData.group_id);
    }
  }

  function logout() {
    localStorage.removeItem("lendapp_user");
    localStorage.removeItem("lendapp_group");
    localStorage.removeItem("lendapp_groups");
    setUser(null);
    setGroupId(null);
    setGroups([]);
  }

  function setGroup(id) {
    const numId = parseInt(String(id), 10);
    if (isNaN(numId)) return;
    localStorage.setItem("lendapp_group", String(numId));
    setGroupId(numId);
  }

  function addGroup(group) {
    const updated = [...groups.filter(g => g.id !== group.id), group];
    localStorage.setItem("lendapp_groups", JSON.stringify(updated));
    setGroups(updated);
  }

  return (
    <AuthContext.Provider value={{ user, groupId, groups, login, logout, setGroup, addGroup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
