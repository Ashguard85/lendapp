import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lendapp_user")); } catch { return null; }
  });
  const [groupId, setGroupId] = useState(() => localStorage.getItem("lendapp_group"));

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
    localStorage.setItem("lendapp_group", id);
    setGroupId(id);
  }

  return (
    <AuthContext.Provider value={{ user, groupId, login, logout, setGroup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
