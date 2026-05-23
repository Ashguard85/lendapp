import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lendapp_user")); } catch { return null; }
  });
  const [groupId, setGroupId] = useState(() => {
    const val = localStorage.getItem("lendapp_group");
    return val ? parseInt(val, 10) : null;
  });

  function login(userData) {
    localStorage.setItem("lendapp_user", JSON.stringify(userData));
    setUser(userData);
  }
  function logout() {
    localStorage.removeItem("lendapp_user");
    localStorage.removeItem("lendapp_group");
    setUser(null);
    setGroupId(null);
  }
  function setGroup(id) {
    const numId = parseInt(id, 10);
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
