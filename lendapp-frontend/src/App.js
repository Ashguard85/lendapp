import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import Sidebar from "./components/Sidebar";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ItemsPage, { ItemDetailPage } from "./pages/ItemsPage";
import BookingsPage from "./pages/BookingsPage";
import GroupPage from "./pages/GroupPage";

function AppShell() {
  const { user } = useAuth();
  if (!user) return <AuthPage />;
  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/group" element={<GroupPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
