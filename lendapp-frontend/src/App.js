import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import AiChat from "./components/AiChat";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ItemsPage, { ItemDetailPage } from "./pages/ItemsPage";
import BookingsPage from "./pages/BookingsPage";
import GroupPage from "./pages/GroupPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminGroups from "./pages/admin/AdminGroups";
import AdminItems from "./pages/admin/AdminItems";

function AdminShell({ children }) {
  return <AdminLayout>{children}</AdminLayout>;
}

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
          <Route path="/admin" element={<AdminShell><AdminDashboard /></AdminShell>} />
          <Route path="/admin/users" element={<AdminShell><AdminUsers /></AdminShell>} />
          <Route path="/admin/groups" element={<AdminShell><AdminGroups /></AdminShell>} />
          <Route path="/admin/items" element={<AdminShell><AdminItems /></AdminShell>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <BottomNav />
      <AiChat />
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
