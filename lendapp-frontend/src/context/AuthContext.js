import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lendapp_user")); } catch { return null; }
  });
  const [groups, setGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lendapp_groups")) || []; } catch { return []; }
  });

  const groupId = groups.length > 0 ? groups[0].id : null;
  const groupIds = groups.map(g => g.id);

  function login(userData) {
    localStorage.setItem("lendapp_user", JSON.stringify(userData));
    setUser(userData);
    if (userData.groups && userData.groups.length) {
      localStorage.setItem("lendapp_groups", JSON.stringify(userData.groups));
      setGroups(userData.groups);
    }
  }
  function logout() {
    localStorage.removeItem("lendapp_user");
    localStorage.removeItem("lendapp_groups");
    setUser(null);
    setGroups([]);
  }
  function addGroup(group) {
    const updated = [...groups.filter(g => g.id !== group.id), group];
    localStorage.setItem("lendapp_groups", JSON.stringify(updated));
    setGroups(updated);
  }
  function setGroup(id) {
    const g = groups.find(g => g.id === parseInt(id));
    if (!g) return;
    const updated = [g, ...groups.filter(x => x.id !== g.id)];
    localStorage.setItem("lendapp_groups", JSON.stringify(updated));
    setGroups(updated);
  }

  function removeGroup(id) {
    const updated = groups.filter(g => g.id !== id);
    localStorage.setItem('lendapp_groups', JSON.stringify(updated));
    setGroups(updated);
  }

  return (
    <AuthContext.Provider value={{ user, groups, groupId, groupIds, login, logout, addGroup, setGroup, removeGroup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
