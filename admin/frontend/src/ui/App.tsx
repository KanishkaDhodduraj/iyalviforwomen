import { useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, Boxes, ChartNoAxesCombined, ContactRound, LayoutDashboard, LogOut, Menu,
  Moon, PackageCheck, Settings, ShieldCheck, Sun, TicketPercent, UsersRound, Wallet, X,
} from "lucide-react";
import { authApi } from "../api";
import { authKey, localAutoLoginDisabledKey, LoginPage, ProtectedRoute, useAdmin } from "../auth";
import {
  AuditPage, CustomerDetailPage, CustomersPage, DashboardPage, DiscountsPage, MessagesPage,
  OrderDetailPage, OrdersPage, PaymentsPage, ProductEditorPage, ProductsPage, ReportsPage,
  SettingsPage, StaffPage,
} from "./pages";
import { ToastProvider } from "./shared";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

const navigation = [
  { label: "Overview", to: "/", icon: LayoutDashboard, roles: ["superadmin", "manager"] },
  { label: "Orders", to: "/orders", icon: PackageCheck, roles: ["superadmin", "manager", "support"] },
  { label: "Products", to: "/products", icon: Boxes, roles: ["superadmin", "manager"] },
  { label: "Customers", to: "/customers", icon: UsersRound, roles: ["superadmin", "manager", "support"] },
  { label: "Payments", to: "/payments", icon: Wallet, roles: ["superadmin", "manager"] },
  { label: "Discounts & coupons", to: "/discounts", icon: TicketPercent, roles: ["superadmin", "manager"] },
  { label: "Reports", to: "/reports", icon: ChartNoAxesCombined, roles: ["superadmin", "manager"] },
  { label: "Messages", to: "/messages", icon: ContactRound, roles: ["superadmin", "manager"] },
  { label: "Audit log", to: "/audit", icon: Activity, roles: ["superadmin"] },
  { label: "Staff", to: "/staff", icon: ShieldCheck, roles: ["superadmin"] },
  { label: "Settings", to: "/settings", icon: Settings, roles: ["superadmin", "manager"] },
];

function AdminLayout() {
  const adminQuery = useAdmin();
  const admin = adminQuery.data;
  const cache = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  if (!admin) return <Navigate to="/login" replace />;
  const label = navigation.find((item) => item.to === location.pathname)?.label ?? (
    location.pathname.startsWith("/orders/") ? "Order details" : location.pathname.startsWith("/customers/") ? "Customer details" : "Product editor"
  );
  async function logout() {
    if (import.meta.env.DEV) sessionStorage.setItem(localAutoLoginDisabledKey, "true");
    try { await authApi.logout(); } catch { /* The secure server session may already be unavailable. */ }
    cache.setQueryData(authKey, null);
    await cache.invalidateQueries({ queryKey: authKey });
    await navigate("/login", { replace: true });
  }
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }
  const permitted = navigation.filter((item) => item.roles.includes(admin.role));
  return <div className="app-frame">
    {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><div className="brand-mark small-mark">I</div><div><strong>IYALVI</strong><span>ADMIN CONSOLE</span></div><button className="icon-button close-sidebar" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">{permitted.map(({ label: itemLabel, to, icon: Icon }) => <Link key={to} to={to} onClick={() => setSidebarOpen(false)} className={`nav-link ${location.pathname === to || (to !== "/" && location.pathname.startsWith(`${to}/`)) ? "nav-active" : ""}`}><Icon size={18} strokeWidth={1.8} /><span>{itemLabel}</span></Link>)}</nav>
      <div className="sidebar-bottom"><div className="secure-box"><ShieldCheck size={17} /><span><b>Secure workspace</b><small>Protected admin access</small></span></div>
        <button className="profile-card" onClick={() => void logout()}><span className="avatar">{admin.email.slice(0, 1).toUpperCase()}</span><span className="profile-text"><b>{admin.email}</b><small>{admin.role}</small></span><LogOut size={16} /></button>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-start"><button className="icon-button menu-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><b>{label}</b></div></div>
        <div className="topbar-actions"><button className="icon-button theme-button" aria-label={dark ? "Use light mode" : "Use dark mode"} onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="top-avatar" aria-label="Sign out" onClick={() => void logout()}>{admin.email.slice(0, 1).toUpperCase()}</button></div>
      </header>
      <div className="page-content"><Outlet /><footer className="page-footer"><span>© 2026 Iyalvi · Admin workspace</span><span>Thoughtfully made for your business</span></footer></div>
    </main>
  </div>;
}

function HomeRoute() {
  const admin = useAdmin().data;
  return admin?.role === "support" ? <Navigate to="/orders" replace /> : <DashboardPage />;
}

function RequiresRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const admin = useAdmin().data;
  return admin && roles.includes(admin.role) ? children : <Navigate to="/orders" replace />;
}

export function AdminRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AdminLayout />}>
        <Route index element={<HomeRoute />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="products" element={<RequiresRole roles={["superadmin", "manager"]}><ProductsPage /></RequiresRole>} />
        <Route path="products/new" element={<RequiresRole roles={["superadmin", "manager"]}><ProductEditorPage /></RequiresRole>} />
        <Route path="products/:id/edit" element={<RequiresRole roles={["superadmin", "manager"]}><ProductEditorPage /></RequiresRole>} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="payments" element={<RequiresRole roles={["superadmin", "manager"]}><PaymentsPage /></RequiresRole>} />
        <Route path="discounts" element={<RequiresRole roles={["superadmin", "manager"]}><DiscountsPage /></RequiresRole>} />
        <Route path="messages" element={<RequiresRole roles={["superadmin", "manager"]}><MessagesPage /></RequiresRole>} />
        <Route path="audit" element={<RequiresRole roles={["superadmin"]}><AuditPage /></RequiresRole>} />
        <Route path="reports" element={<RequiresRole roles={["superadmin", "manager"]}><ReportsPage /></RequiresRole>} />
        <Route path="staff" element={<RequiresRole roles={["superadmin"]}><StaffPage /></RequiresRole>} />
        <Route path="settings" element={<RequiresRole roles={["superadmin", "manager"]}><SettingsPage /></RequiresRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  </Routes>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><ToastProvider><BrowserRouter><AdminRoutes /></BrowserRouter></ToastProvider></QueryClientProvider>;
}
