import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lendapp_user")); } catch { return null; }
  });
  const [groupId, setGroupId] = useState(() => {
    const val = localStorage.getItem("lendapp_group");
    if (!val) return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  });

  function login(userData) {
    localStorage.setItem("lendapp_user", JSON.stringify(userData));
    setUser(userData);
    if (userData.group_id) {
      localStorage.setItem("lendapp_group", String(userData.group_id));
      setGroupId(userData.group_id);
    }
  }
  function logout() {
    localStorage.removeItem("lendapp_user");
    localStorage.removeItem("lendapp_group");
    setUser(null);
    setGroupId(null);
  }
  function setGroup(id) {
    const numId = parseInt(String(id), 10);
    if (isNaN(numId)) return;
    localStorage.setItem("lendapp_group", String(numId));
    setGroupId(numId);
  }

  return (
    <AuthContext.Provider value={{ user, groupId, login, logout, setGroup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
