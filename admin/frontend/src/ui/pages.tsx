import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Activity, ArrowDownToLine, ArrowLeft, Boxes, CircleDollarSign,
  FileText, ImagePlus, Mail, MessageCircle, PackageCheck, Plus, ShoppingBag,
  TicketPercent, UsersRound,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { adminApi, type PageResult } from "../api";
import { useAdmin } from "../auth";
import {
  ConfirmAction, DataTable, EmptyState, ErrorState, formatValue, PageHeader, Pagination,
  SearchField, SkeletonRows, useToast,
} from "./shared";

type Row = Record<string, unknown> & { _id: string };
const PAGE_SIZE = 25;
const money = (value: unknown) => `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const status = (value: unknown) => <span className={`status-pill status-${String(value ?? "").toLowerCase().replaceAll(" ", "-")}`}>{formatValue(value)}</span>;
const recordName = (row: Row) => String(row.name ?? row.email ?? row._id);

function usePaged<T extends Row>(path: string, page: number, search = "") {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (search.trim()) params.set("search", search.trim());
  return useQuery({
    queryKey: ["admin", path, page, search],
    queryFn: () => adminApi.get<PageResult<T>>(`${path}?${params.toString()}`),
  });
}

function ListingPage<T extends Row>({
  title, subtitle, path, columns, queryFilters = {}, allowSearch = true, details, action, empty,
}: {
  title: string;
  subtitle: string;
  path: string;
  columns: Array<{ key: string; label: string; render?: (row: T) => ReactNode; className?: string }>;
  queryFilters?: Record<string, string>;
  allowSearch?: boolean;
  details?: (row: T) => string;
  action?: ReactNode;
  empty?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const queryParams = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), ...queryFilters });
  if (search.trim()) queryParams.set("search", search.trim());
  const query = useQuery({
    queryKey: ["admin", path, page, search, queryFilters],
    queryFn: () => adminApi.get<PageResult<T>>(`${path}?${queryParams.toString()}`),
  });
  return <>
    <PageHeader eyebrow="STORE MANAGEMENT" title={title} description={subtitle} actions={<>{allowSearch && <SearchField value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}{action}</>} />
    <DataTable rows={query.data?.items ?? []} columns={columns} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} rowLink={details} emptyTitle={`No ${title.toLowerCase()} found`} emptyMessage={empty ?? "Records will appear here when available."} />
    {query.data && <Pagination page={page} limit={PAGE_SIZE} total={query.data.total} setPage={setPage} />}
  </>;
}

type DashboardData = {
  orders: number;
  today: { revenue: number; orders: number };
  month: { revenue: number; orders: number };
  newUsersToday: number;
  averageOrderValue: number;
  pendingOrders: number;
  lowStockProducts: Array<{ _id?: string; name: string; sku?: string; stock: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  salesDaily30d: Array<{ date: string; revenue: number; orders: number }>;
  revenueByCategory: Array<{ _id: string; revenue: number; units: number }>;
};

export function DashboardPage() {
  const query = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => adminApi.get<DashboardData>("/dashboard") });
  const data = query.data;
  const metrics = [
    { title: "Revenue this month", value: money(data?.month.revenue), note: `${data?.month.orders ?? 0} orders`, icon: CircleDollarSign },
    { title: "Orders today", value: (data?.today.orders ?? 0).toLocaleString("en-IN"), note: `${money(data?.today.revenue)} collected`, icon: PackageCheck },
    { title: "Pending orders", value: (data?.pendingOrders ?? 0).toLocaleString("en-IN"), note: "Awaiting fulfilment", icon: ShoppingBag },
    { title: "New customers today", value: (data?.newUsersToday ?? 0).toLocaleString("en-IN"), note: `AOV ${money(data?.averageOrderValue)}`, icon: UsersRound },
  ];
  return <>
    <PageHeader eyebrow="YOUR STORE AT A GLANCE" title="Overview" description="A considered view of sales, orders, and what needs attention." actions={<Link className="secondary-button" to="/reports"><FileText size={16} /> Reports</Link>} />
    {query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
    <section className="metric-grid">{metrics.map(({ title, value, note, icon: Icon }, index) => <article className="metric-card" key={title}>
      <div className="metric-top"><span>{title}</span><span className={`metric-icon metric-icon-${index}`}><Icon size={18} /></span></div>
      {query.isLoading ? <div className="skeleton metric-skeleton" /> : <strong>{value}</strong>}<small>{note}</small>
    </article>)}</section>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Sales performance</h2><p>Paid revenue over the last 30 days</p></div><span className="role-pill">30 days</span></div>
        {query.isLoading ? <SkeletonRows count={4} /> : data?.salesDaily30d?.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.salesDaily30d} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}><defs><linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8a2943" stopOpacity={0.22} /><stop offset="100%" stopColor="#8a2943" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)" /><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tickLine={false} axisLine={false} minTickGap={24} /><YAxis tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} width={48} /><Tooltip formatter={(value) => [money(value), "Revenue"]} labelFormatter={(value) => new Date(String(value)).toLocaleDateString()} /><Area type="monotone" dataKey="revenue" stroke="#8a2943" strokeWidth={2.5} fill="url(#sales-fill)" /></AreaChart></ResponsiveContainer></div> : <EmptyState title="No sales activity yet" message="Sales will appear here when orders are paid." />}
      </section>
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Revenue by category</h2><p>Paid product sales</p></div></div>
        {query.isLoading ? <SkeletonRows count={4} /> : data?.revenueByCategory?.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.revenueByCategory} dataKey="revenue" nameKey="_id" innerRadius={55} outerRadius={85} paddingAngle={4}>{data.revenueByCategory.map((entry, index) => <Cell key={entry._id} fill={["#11243b", "#8a2943", "#c49752", "#7d8793"][index % 4]} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer></div> : <EmptyState title="No category data" message="Category revenue will appear once sales are recorded." />}
        <div className="category-legend">{(data?.revenueByCategory ?? []).map((item) => <span key={item._id}><i />{item._id}<b>{money(item.revenue)}</b></span>)}</div>
      </section>
      <section className="panel"><div className="panel-heading"><div><h2>Top-selling products</h2><p>By units sold this month</p></div><Boxes size={18} /></div>
        {query.isLoading ? <SkeletonRows count={4} /> : data?.topProducts?.length ? <div className="chart-wrap chart-short"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.topProducts} layout="vertical" margin={{ left: 25, right: 15 }}><CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="var(--line)" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="quantity" fill="#c49752" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No product sales yet" message="Top-selling products will appear after orders are placed." />}
      </section>
      <section className="panel low-stock"><div className="panel-heading"><div><h2>Low stock watch</h2><p>Active items with 5 or fewer units</p></div><Link to="/products">View products →</Link></div>
        {query.isLoading ? <SkeletonRows count={4} /> : data?.lowStockProducts?.length ? data.lowStockProducts.slice(0, 5).map((product) => <div className="stock-row" key={product._id ?? product.name}><span className="stock-dot" /><b>{product.name}</b><small>{product.sku ?? "No SKU"}</small><strong>{product.stock} left</strong></div>) : <EmptyState title="Stock levels look good" message="Low-stock products will be listed here." />}
      </section>
    </div>
  </>;
}

export function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const options = [
    { key: "orderStatus", label: "Status", render: (row: Row) => status(row.orderStatus) },
    { key: "user", label: "Customer" },
    { key: "paymentMethod", label: "Method" },
    { key: "paymentStatus", label: "Payment", render: (row: Row) => status(row.paymentStatus) },
    { key: "total", label: "Total", render: (row: Row) => money(row.total) },
    { key: "createdAt", label: "Placed" },
  ];
  return <ListingPage title="Orders" subtitle="Track fulfilment, review payment status, and open each order." path="/orders" queryFilters={statusFilter ? { status: statusFilter } : {}} columns={options} details={(row) => `/orders/${row._id}`} action={<><select aria-label="Filter by order status" className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select><DownloadButton path="/exports/orders.csv" filename="iyalvi-orders.csv" label="Export" /></>} />;
}

function DownloadButton({ path, filename, label }: { path: string; filename: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return <button className="secondary-button" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await adminApi.saveDownload(path, filename); toast("Download ready."); } catch (error) { toast(error instanceof Error ? error.message : "Download failed.", "error"); } finally { setBusy(false); }
  }}><ArrowDownToLine size={16} />{busy ? "Preparing…" : label}</button>;
}

type Order = Row & {
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  user: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  statusHistory?: Array<Record<string, unknown>>;
  adminNotes?: Array<Record<string, unknown>>;
};

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const admin = useAdmin().data;
  const canManage = admin?.role === "superadmin" || admin?.role === "manager";
  const [note, setNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courier, setCourier] = useState("");
  const query = useQuery({ queryKey: ["admin", "orders", id], queryFn: () => adminApi.get<{ item: Order }>(`/orders/${id}`) });
  const order = query.data?.item;
  const nextStatus = ({ placed: "packed", packed: "shipped", shipped: "out_for_delivery", out_for_delivery: "delivered" } as Record<string, string>)[order?.orderStatus ?? ""];
  const progressSteps = ["placed", "packed", "shipped", "out_for_delivery", "delivered"];
  const progressIndex = progressSteps.indexOf(order?.orderStatus ?? "");
  const mutation = useMutation({
    mutationFn: ({ path, body, method = "patch" }: { path: string; body: unknown; method?: "patch" | "post" }) => method === "post" ? adminApi.post(path, body) : adminApi.patch(path, body),
    onSuccess: () => { toast("Order updated."); setNote(""); void queryClient.invalidateQueries({ queryKey: ["admin"] }); void query.refetch(); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not update the order.", "error"),
  });
  if (query.isLoading) return <><PageHeader eyebrow="ORDER MANAGEMENT" title="Order details" description="Loading order…" /><SkeletonRows /></>;
  if (query.error || !order) return <><PageHeader eyebrow="ORDER MANAGEMENT" title="Order not found" description="The order could not be loaded." /><ErrorState error={query.error} retry={() => void query.refetch()} /><Link to="/orders" className="secondary-button"><ArrowLeft size={16} />Back to orders</Link></>;
  return <>
    <PageHeader eyebrow={`ORDER ${id.slice(-8).toUpperCase()}`} title="Order details" description={`Placed ${formatValue(order.createdAt)}`} actions={<Link className="secondary-button" to="/orders"><ArrowLeft size={16} />All orders</Link>} />
    <div className="detail-grid">
      <section className="panel detail-main"><div className="panel-heading"><div><h2>Order summary</h2><p>{recordName(order.user as Row)} · {formatValue((order.user as Row)?.email)}</p></div>{status(order.orderStatus)}</div>
        <ol className={`admin-order-stepper ${order.orderStatus === "cancelled" ? "is-cancelled" : ""}`} aria-label="Order progress steps">{progressSteps.map((stepName, index) => <li key={stepName} className={index < progressIndex ? "is-complete" : index === progressIndex ? "is-current" : ""}>{formatValue(stepName)}</li>)}</ol>
        <div className="detail-pairs"><span>Payment</span><b>{formatValue(order.paymentMethod)} · {formatValue(order.paymentStatus)}</b><span>Order total</span><b>{money(order.total)}</b><span>Tracking</span><b>{formatValue(order.trackingNumber)} {order.courier ? `(${formatValue(order.courier)})` : ""}</b></div>
        <div className="table-scroll"><table><thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Unit price</th></tr></thead><tbody>{(order.items ?? []).map((item, index) => <tr key={String(item.product ?? index)}><td>{formatValue(item.name)}</td><td>{formatValue(item.size)}</td><td>{formatValue(item.qty)}</td><td>{money(item.unitPrice)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="panel"><h2>Update order</h2><p className="muted-copy">Add a fulfilment update or an internal note.</p>
        {canManage && order.orderStatus !== "cancelled" && order.orderStatus !== "delivered" && <div className="form-grid"><label>Progress update<input readOnly value={nextStatus ? `Next step: ${formatValue(nextStatus)}` : "No further fulfilment step"} /></label><label>Internal note<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Visible only to staff" /></label><label>Courier<input value={courier} onChange={(event) => setCourier(event.target.value)} /></label><label>Tracking number<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></label>
          <div className="action-row">
            {nextStatus && <button className="primary-button" onClick={() => mutation.mutate({ path: `/orders/${id}/status`, body: { status: nextStatus, ...(note ? { note } : {}), ...(courier.trim() ? { courier: courier.trim() } : {}), ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}) } })}>Update progress: {formatValue(nextStatus)}</button>}
            <button className="secondary-button" disabled={!courier || !trackingNumber} onClick={() => mutation.mutate({ path: `/orders/${id}/tracking`, body: { courier, trackingNumber } })}>Save tracking</button>
            <button className="secondary-button" disabled={!note.trim()} onClick={() => mutation.mutate({ path: `/orders/${id}/notes`, body: { note }, method: "post" })}>Add note</button>
          </div>
        </div>}
        {canManage && ["placed", "packed"].includes(order.orderStatus) && <ConfirmAction label="Cancel order" title="Cancel this order?" description="This changes the order state and is recorded in the audit log." destructive onConfirm={async () => { await adminApi.post(`/orders/${id}/cancel`, { note: note.trim() || "Cancelled by administrator" }); toast("Order cancelled."); void queryClient.invalidateQueries({ queryKey: ["admin"] }); void query.refetch(); }} />}
      </section>
      <section className="panel"><h2>Status history</h2>{order.statusHistory?.length ? <div className="timeline">{order.statusHistory.map((entry, index) => <div key={index}><i /> <div><b>{formatValue(entry.status)}</b><small>{formatValue(entry.at)}{entry.note ? ` · ${String(entry.note)}` : ""}</small></div></div>)}</div> : <p className="muted-copy">No status history available.</p>}</section>
      <section className="panel"><h2>Internal notes</h2>{order.adminNotes?.length ? <div className="timeline">{order.adminNotes.map((entry, index) => <div key={index}><i /><div><b>{formatValue(entry.addedBy)}</b><small>{formatValue(entry.at)} · {formatValue(entry.note)}</small></div></div>)}</div> : <p className="muted-copy">No internal notes.</p>}</section>
    </div>
  </>;
}

export function CustomersPage() {
  const columns = [
    { key: "name", label: "Customer" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "totalOrders", label: "Orders" },
    { key: "lifetimeValue", label: "Lifetime value", render: (row: Row) => money(row.lifetimeValue) },
    { key: "isBlocked", label: "Account", render: (row: Row) => status(row.isBlocked ? "Blocked" : "Active") },
  ];
  return <ListingPage title="Customers" subtitle="Understand customer activity and account history." path="/customers" columns={columns} details={(row) => `/customers/${row._id}`} />;
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const query = useQuery({ queryKey: ["admin", "customers", id], queryFn: () => adminApi.get<{ item: Row; totalOrders: number; lifetimeValue: number; addresses: Row[]; wishlist?: { products?: Row[] } }>(`/customers/${id}`) });
  const orderQuery = useQuery({
    queryKey: ["admin", "customer-orders", id],
    queryFn: () => adminApi.get<PageResult<Row>>(`/orders?customerId=${encodeURIComponent(id)}&page=1&limit=20`),
  });
  const queryClient = useQueryClient();
  const toast = useToast();
  const admin = useAdmin().data;
  const canManage = admin?.role === "superadmin" || admin?.role === "manager";
  const customer = query.data?.item;
  if (query.isLoading) return <><PageHeader eyebrow="CUSTOMER RECORD" title="Customer" description="Loading customer profile…" /><SkeletonRows /></>;
  if (query.error || !customer) return <><PageHeader eyebrow="CUSTOMER RECORD" title="Customer not found" description="The customer profile could not be loaded." /><ErrorState error={query.error} retry={() => void query.refetch()} /></>;
  return <>
    <PageHeader eyebrow="CUSTOMER RECORD" title={String(customer.name ?? "Customer")} description={String(customer.email ?? "")} actions={<Link className="secondary-button" to="/customers"><ArrowLeft size={16} />All customers</Link>} />
    <div className="metric-grid three-metrics"><Metric title="Orders" value={query.data?.totalOrders} icon={<PackageCheck size={18} />} /><Metric title="Lifetime value" value={money(query.data?.lifetimeValue)} icon={<CircleDollarSign size={18} />} /><Metric title="Account" value={customer.isBlocked ? "Blocked" : "Active"} icon={<UsersRound size={18} />} /></div>
    {canManage && <section className="panel customer-action"><div><h2>Account access</h2><p className="muted-copy">Blocking disables account access and active customer sessions.</p></div>
      <ConfirmAction label={customer.isBlocked ? "Unblock customer" : "Block customer"} title={customer.isBlocked ? "Restore customer access?" : "Block this customer?"} description="This account access change is recorded in the audit log." destructive={!customer.isBlocked} onConfirm={async () => {
        await adminApi.patch(`/customers/${id}/block`, { isBlocked: !customer.isBlocked }); toast(customer.isBlocked ? "Customer unblocked." : "Customer blocked."); await queryClient.invalidateQueries({ queryKey: ["admin", "customers"] }); await query.refetch();
      }} />
    </section>}
    <section className="panel customer-orders"><div className="panel-heading"><div><h2>Order history</h2><p>Most recent customer orders</p></div></div><DataTable rows={orderQuery.data?.items ?? []} loading={orderQuery.isLoading} error={orderQuery.error} onRetry={() => void orderQuery.refetch()} columns={[
      { key: "_id", label: "Order", render: (row) => row._id.slice(-8).toUpperCase() },
      { key: "orderStatus", label: "Status", render: (row) => status(row.orderStatus) },
      { key: "paymentStatus", label: "Payment", render: (row) => status(row.paymentStatus) },
      { key: "total", label: "Total", render: (row) => money(row.total) },
      { key: "createdAt", label: "Placed" },
    ]} rowLink={(row) => `/orders/${row._id}`} /></section>
    <div className="detail-grid"><section className="panel"><h2>Addresses</h2>{query.data?.addresses?.length ? query.data.addresses.map((address) => <div className="address-card" key={String(address._id)}>{[address.name, address.line1, address.line2, address.city, address.state, address.postalCode, address.phone].filter(Boolean).map(formatValue).join(" · ")}</div>) : <EmptyState title="No saved addresses" message="Addresses are added by the customer." />}</section>
      <section className="panel"><h2>Wishlist</h2>{query.data?.wishlist?.products?.length ? <div className="compact-list">{query.data.wishlist.products.map((item) => <div key={item._id}>{recordName(item)}<span>{money(item.price)}</span></div>)}</div> : <EmptyState title="Wishlist is empty" message="No saved products are available." />}</section></div>
  </>;
}

function Metric({ title, value, icon }: { title: string; value: unknown; icon: ReactNode }) {
  return <article className="metric-card"><div className="metric-top"><span>{title}</span><span className="metric-icon">{icon}</span></div><strong>{formatValue(value)}</strong></article>;
}

export function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (statusFilter) params.set("status", statusFilter);
  if (methodFilter) params.set("method", methodFilter);
  if (search.trim()) params.set("search", search.trim());
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(`${to}T23:59:59.999`).toISOString());
  const query = useQuery({ queryKey: ["admin", "payments", statusFilter, methodFilter, search, from, to, page], queryFn: () => adminApi.get<PageResult<Row> & { totalsByMethod: Row[]; pendingCodAmount: number; pendingCodOrders: number }>(`/payments?${params}`) });
  const mutation = useMutation({
    mutationFn: () => adminApi.post(`/payments/${selected?._id}/refund`, { amount: Number(amount), note }),
    onSuccess: () => { toast("Refund recorded."); setSelected(null); setAmount(""); setNote(""); void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] }); },
    onError: (error) => toast(error instanceof Error ? error.message : "Refund failed.", "error"),
  });
  const columns = [
    { key: "user", label: "Customer" },
    { key: "_id", label: "Order" },
    { key: "paymentMethod", label: "Method" },
    { key: "paymentStatus", label: "Status", render: (row: Row) => status(row.paymentStatus) },
    { key: "total", label: "Amount", render: (row: Row) => money(row.total) },
    { key: "refundStatus", label: "Refund" },
    { key: "createdAt", label: "Date" },
    { key: "actions", label: "Action", render: (row: Row) => row.paymentStatus === "paid" && row.refundStatus !== "refunded"
      ? <button className="text-button" onClick={() => { setSelected(row); setAmount(String(row.total)); }}>Refund</button>
      : row.paymentMethod === "COD" && row.paymentStatus === "pending"
        ? <ConfirmAction label="Mark paid" title="Confirm cash collection?" description="This marks the cash-on-delivery payment as received and is recorded in the audit log." onConfirm={async () => {
          await adminApi.post(`/orders/${row._id}/mark-paid`, {});
          toast("Payment marked as paid.");
          await queryClient.invalidateQueries({ queryKey: ["admin"] });
        }} />
        : "—" },
  ];
  return <>
    <PageHeader eyebrow="FINANCE" title="Payments" description="Review payment methods, statuses, dates, and refund activity." />
    <div className="filter-bar">
      <input aria-label="Search payments" placeholder="Search order or customer" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      <select className="filter-select" aria-label="Filter by payment method" value={methodFilter} onChange={(event) => { setMethodFilter(event.target.value); setPage(1); }}><option value="">All methods</option>{["COD", "UPI", "CARD", "NETBANKING"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select className="filter-select" aria-label="Filter by payment status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{["pending", "paid", "failed", "refunded"].map((value) => <option key={value}>{value}</option>)}</select>
      <label>From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
      <label>To<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
    </div>
    <div className="metric-grid payment-metrics">{["COD", "UPI", "CARD", "NETBANKING"].map((methodName) => {
      const totals = query.data?.totalsByMethod?.find((item) => item.method === methodName);
      return <Metric key={methodName} title={`${methodName} total`} value={money(totals?.totalAmount ?? 0)} icon={<CircleDollarSign size={18} />} />;
    })}<Metric title="COD pending" value={money(query.data?.pendingCodAmount)} icon={<PackageCheck size={18} />} /></div>
    <DataTable rows={query.data?.items ?? []} columns={columns} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} />
    {query.data && <Pagination page={page} limit={PAGE_SIZE} total={query.data.total} setPage={setPage} />}
    {selected && <div className="modal-scrim"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="refund-heading"><h2 id="refund-heading">Record a refund</h2><p>Refund amounts are limited to the original payment total.</p><div className="form-grid"><label>Amount (₹)<input type="number" min="0.01" step="0.01" max={Number(selected.total)} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Reason<input value={note} onChange={(event) => setNote(event.target.value)} /></label></div><div className="modal-actions"><button className="secondary-button" onClick={() => setSelected(null)}>Close</button><button className="primary-button" disabled={!Number(amount) || !note.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : "Confirm refund"}</button></div></section></div>}
  </>;
}

const productFormSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  description: z.string().max(5000).default(""),
  category: z.enum(["", "saree", "kurti"]).transform((value) => value || undefined),
  subCategory: z.string().trim().optional(),
  fabric: z.string().trim().optional(),
  colors: z.string().default(""),
  sizes: z.array(z.object({ size: z.string().trim().min(1, "Size label is required"), stock: z.coerce.number().int().min(0) }).strict()).default([]),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  mrp: z.coerce.number().positive("MRP is required"),
  costPrice: z.preprocess((value) => value === "" || value === undefined ? undefined : value, z.coerce.number().min(0).optional()),
  discountType: z.enum(["percent", "flat"]).optional(),
  discountValue: z.preprocess((value) => value === "" || value === undefined ? undefined : value, z.coerce.number().positive().optional()),
  discountStartsAt: z.string().optional(),
  discountEndsAt: z.string().optional(),
  tags: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isNewArrival: z.boolean(),
}).superRefine((value, context) => {
  if (value.discountType && value.discountValue === undefined) {
    context.addIssue({ code: "custom", message: "Enter a discount value.", path: ["discountValue"] });
  }
  if (value.discountType && !value.discountStartsAt) {
    context.addIssue({ code: "custom", message: "Choose a discount start date.", path: ["discountStartsAt"] });
  }
  if (value.discountType && !value.discountEndsAt) {
    context.addIssue({ code: "custom", message: "Choose a discount end date.", path: ["discountEndsAt"] });
  }
  if (value.discountType === "percent" && value.discountValue !== undefined && (value.discountValue < 1 || value.discountValue > 90)) {
    context.addIssue({ code: "custom", message: "Percentage must be between 1 and 90.", path: ["discountValue"] });
  }
});
type ProductInput = z.input<typeof productFormSchema>;
type ProductFields = z.output<typeof productFormSchema>;
type Product = Row & { images?: Array<{ url: string; key: string; alt?: string; isPrimary: boolean }>; sizes?: Array<{ size: string; stock: number }>; colors?: string[]; tags?: string[] };

export function ProductsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const archiveProduct = async (row: Row) => {
    try {
      await adminApi.delete(`/products/${row._id}`);
      toast("Product deleted from the storefront.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "/products"] });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Product could not be deleted.", "error");
      throw error;
    }
  };
  const columns = [
    { key: "name", label: "Product" },
    { key: "category", label: "Category" },
    { key: "mrp", label: "MRP", render: (row: Row) => money(row.mrp) },
    { key: "stock", label: "Stock", render: (row: Row) => <>{Number(row.stock) <= 5 && <span className="status-pill status-pending">Low stock</span>} {formatValue(row.stock)}</> },
    { key: "isActive", label: "Status", render: (row: Row) => status(row.isActive ? "Active" : "Inactive") },
    { key: "actions", label: "Action", render: (row: Row) => <>
      <Link className="text-button" to={`/products/${row._id}/edit`}>Edit</Link>
      <button className="text-button" onClick={async () => {
        try {
          await adminApi.patch(`/products/${row._id}`, { isActive: !row.isActive });
          toast(row.isActive ? "Product deactivated." : "Product activated.");
          await queryClient.invalidateQueries({ queryKey: ["admin", "/products"] });
        } catch (error) {
          toast(error instanceof Error ? error.message : "Product status could not be changed.", "error");
        }
      }}>{row.isActive ? "Deactivate" : "Activate"}</button>
      <ConfirmAction
        label="Delete"
        title={`Delete ${String(row.name ?? "this product")}?`}
        description="This removes the product from the customer storefront. Existing order records are preserved."
        destructive
        onConfirm={() => archiveProduct(row)}
      />
    </> },
  ];
  return <ListingPage title="Products" subtitle="Manage your catalogue, pricing, inventory, and imagery." path="/products" columns={columns} details={(row) => `/products/${row._id}/edit`} action={<Link to="/products/new" className="primary-button"><Plus size={16} />Add product</Link>} />;
}

export function ProductEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [images, setImages] = useState<File[]>([]);
  const query = useQuery({
    queryKey: ["admin", "products", id],
    queryFn: async () => (await adminApi.get<{ item: Product }>(`/products/${id}`)).item,
    enabled: isEdit,
  });
  const discountQuery = useQuery({
    queryKey: ["admin", "products", id, "discount"],
    queryFn: () => adminApi.get<{ item: Row | null }>(`/products/${id}/discount`),
    enabled: isEdit,
  });
  const toLocalDateTime = (value: unknown) => {
    if (!value) return "";
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  const form = useForm<ProductInput, unknown, ProductFields>({
    resolver: zodResolver(productFormSchema),
    values: query.data ? {
      name: String(query.data.name ?? ""),
      description: String(query.data.description ?? ""),
      category: query.data.category === "kurti" ? "kurti" : query.data.category === "saree" ? "saree" : "",
      subCategory: String(query.data.subCategory ?? ""),
      fabric: String(query.data.fabric ?? ""),
      colors: (query.data.colors ?? []).join(", "),
      sizes: query.data.sizes ?? [],
      stock: Number(query.data.stock ?? 0),
      mrp: Number(query.data.mrp ?? 0),
      costPrice: query.data.costPrice === undefined ? undefined : Number(query.data.costPrice),
      discountType: discountQuery.data?.item?.type === "flat" ? "flat" : discountQuery.data?.item ? "percent" : undefined,
      discountValue: discountQuery.data?.item?.value === undefined ? undefined : Number(discountQuery.data.item.value),
      discountStartsAt: toLocalDateTime(discountQuery.data?.item?.startsAt),
      discountEndsAt: toLocalDateTime(discountQuery.data?.item?.endsAt),
      tags: (query.data.tags ?? []).join(", "),
      isActive: Boolean(query.data.isActive),
      isFeatured: Boolean(query.data.isFeatured),
      isNewArrival: Boolean(query.data.isNewArrival),
    } : undefined,
    defaultValues: { name: "", description: "", category: "", subCategory: "", fabric: "", colors: "", sizes: [], stock: 0, mrp: 0, discountType: undefined, discountValue: undefined, discountStartsAt: "", discountEndsAt: "", tags: "", isActive: true, isFeatured: false, isNewArrival: false },
  });
  const sizeRows = useFieldArray({ control: form.control, name: "sizes" });
  const productDiscountType = useWatch({ control: form.control, name: "discountType" });
  const mutation = useMutation({
    mutationFn: async (values: ProductFields) => {
      const { discountType, discountValue, discountStartsAt, discountEndsAt, ...productValues } = values;
      const payload = {
        ...productValues,
        colors: (values.colors ?? "").split(",").map((value) => value.trim()).filter(Boolean),
        tags: (values.tags ?? "").split(",").map((value) => value.trim()).filter(Boolean),
        ...(values.sizes.length ? { stock: undefined } : {}),
      };
      const saved = isEdit
        ? await adminApi.patch<{ item: Product }>(`/products/${id}`, payload)
        : await adminApi.post<{ item: Product }>("/products", payload);
      const product = saved.item;
      if (discountType && discountValue !== undefined && discountStartsAt && discountEndsAt) {
        await adminApi.patch(`/products/${product._id}/discount`, {
          type: discountType,
          value: discountValue,
          startsAt: new Date(discountStartsAt).toISOString(),
          endsAt: new Date(discountEndsAt).toISOString(),
        });
      }
      if (images.length) {
        const formData = new FormData();
        images.forEach((file) => formData.append("images", file));
        await adminApi.upload(`/products/${product._id}/images`, formData);
      }
      return product;
    },
    onSuccess: async (product) => {
      toast(isEdit ? "Product saved." : "Product created.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "/products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      await navigate(`/products/${product._id}/edit`);
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Product could not be saved.", "error"),
  });
  const fields: Array<{ name: keyof ProductInput; label: string; type?: string }> = [
    { name: "name", label: "Product name" }, { name: "category", label: "Category", type: "select" },
    { name: "subCategory", label: "Sub-category" }, { name: "fabric", label: "Fabric" }, { name: "colors", label: "Colours (comma-separated)" },
    { name: "mrp", label: "MRP (₹)", type: "number" }, { name: "costPrice", label: "Cost price (₹)", type: "number" },
    { name: "tags", label: "Tags (comma-separated)" },
  ];
  if (query.isLoading) return <><PageHeader eyebrow="CATALOGUE" title="Product" description="Loading product details…" /><SkeletonRows /></>;
  if (query.error && isEdit) return <><PageHeader eyebrow="CATALOGUE" title="Product not found" description="This product could not be loaded." actions={<Link to="/products" className="secondary-button"><ArrowLeft size={16} />All products</Link>} /><ErrorState error={query.error} retry={() => void query.refetch()} /></>;
  return <>
    <PageHeader eyebrow="CATALOGUE" title={isEdit ? "Edit product" : "New product"} description="Maintain product details, pricing, variants, and imagery." actions={<Link to="/products" className="secondary-button"><ArrowLeft size={16} />All products</Link>} />
    {query.error && <ErrorState error={query.error} />}
    <form className="panel editor-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <div className="form-grid">{fields.map(({ name, label, type }) => <label key={name}>{label}
        {type === "select" ? <select {...form.register(name)}><option value="">Not specified</option><option value="saree">Saree</option><option value="kurti">Kurti</option></select> : <input required={name === "name" || name === "mrp"} type={type ?? "text"} step={type === "number" ? "0.01" : undefined} {...form.register(name)} />}
        {form.formState.errors[name] && <small className="field-error">{String(form.formState.errors[name]?.message)}</small>}
      </label>)}
        <label className="checkbox-label"><input type="checkbox" {...form.register("isActive")} />Active in storefront</label>
        <label className="checkbox-label"><input type="checkbox" {...form.register("isFeatured")} />Featured product</label>
        <label className="checkbox-label"><input type="checkbox" {...form.register("isNewArrival")} />New arrival</label>
        <label className="full-field">Description<textarea rows={4} {...form.register("description")} /></label>
      </div>
      <section className="product-stock"><h2>Inventory</h2>
        {sizeRows.fields.length > 0 ? <div className="size-stock-list">{sizeRows.fields.map((field, index) => <div className="size-stock-row" key={field.id}>
          <label>Size<input {...form.register(`sizes.${index}.size`)} /></label>
          <label>Stock<input type="number" min="0" step="1" {...form.register(`sizes.${index}.stock`)} /></label>
          <button type="button" className="text-button" onClick={() => sizeRows.remove(index)}>Remove size</button>
          {form.formState.errors.sizes?.[index]?.size?.message && <small className="field-error">{form.formState.errors.sizes[index]?.size?.message}</small>}
        </div>)}</div> : <label>Total stock<input type="number" min="0" step="1" {...form.register("stock")} /></label>}
        <div className="action-row"><button type="button" className="secondary-button" onClick={() => sizeRows.append({ size: "", stock: 0 })}>Add size stock</button></div>
        {form.formState.errors.sizes?.message && <small className="field-error">{form.formState.errors.sizes.message}</small>}
      </section>
      <section className="product-discount"><h2>Optional product discount</h2><p>Creates or updates the linked automatic discount. Leave type blank to keep the current offer unchanged.</p><div className="form-grid">
        <label>Discount type<select {...form.register("discountType")}><option value="">No change</option><option value="percent">Percentage</option><option value="flat">Flat amount</option></select></label>
        <label>Discount value<input type="number" min={productDiscountType === "percent" ? 1 : 0.01} max={productDiscountType === "percent" ? 90 : undefined} step="0.01" {...form.register("discountValue")} /></label>
        <label>Start date/time<input type="datetime-local" {...form.register("discountStartsAt")} /></label>
        <label>End date/time<input type="datetime-local" {...form.register("discountEndsAt")} /></label>
      </div></section>
      <div className="image-upload"><div><b>Product images</b><p>JPEG, PNG, or WebP. Up to 8 images, 5 MB each. Uploads are securely processed.</p></div><label className={`secondary-button ${query.data?.images?.length === 8 ? "disabled-control" : ""}`}><ImagePlus size={16} />Choose images<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={query.data?.images?.length === 8} onChange={(event) => setImages(Array.from(event.target.files ?? []).slice(0, Math.max(0, 8 - (query.data?.images?.length ?? 0))))} /></label></div>
      {images.length > 0 && <div className="file-preview">{images.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}</div>}
      {query.data?.images?.length ? <div className="image-gallery">{query.data.images.map((image) => <div className="image-tile" key={image.key}><img src={image.url} alt={image.alt ?? ""} /><ConfirmAction label="Remove" title="Remove this image?" description="This removes the image from this product gallery." destructive onConfirm={async () => {
        await adminApi.delete(`/products/${id}/images/${encodeURIComponent(image.key)}`);
        toast("Image removed.");
        await query.refetch();
      }} /></div>)}</div> : null}
      <div className="form-footer"><button className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : isEdit ? "Save product" : "Create product"}</button></div>
    </form>
  </>;
}

const discountSchema = z.object({
  name: z.string().trim().min(1),
  scope: z.enum(["product", "category", "collection", "sitewide"]),
  targets: z.string().optional(),
  type: z.enum(["percent", "flat"]),
  value: z.coerce.number().positive(),
  maxDiscount: z.coerce.number().min(0).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  priority: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  isFlashSale: z.boolean(),
  stackable: z.boolean(),
}).superRefine((item, context) => {
  if (new Date(item.endsAt) <= new Date(item.startsAt)) context.addIssue({ code: "custom", message: "End time must be after start time.", path: ["endsAt"] });
  if (item.type === "percent" && (item.value < 1 || item.value > 90)) context.addIssue({ code: "custom", message: "Percentage must be between 1 and 90.", path: ["value"] });
  if (item.scope === "sitewide" && item.targets?.trim()) context.addIssue({ code: "custom", message: "Sitewide discounts do not have targets.", path: ["targets"] });
  if (item.scope !== "sitewide" && !item.targets?.trim()) context.addIssue({ code: "custom", message: "Add one or more targets.", path: ["targets"] });
});
type DiscountFields = z.infer<typeof discountSchema>;

export function DiscountsPage() {
  const [tab, setTab] = useState<"discounts" | "coupons">("discounts");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [page, setPage] = useState(1);
  const path = tab === "discounts" ? "/discounts" : "/coupons";
  const query = usePaged<Row>(path, page);
  const queryClient = useQueryClient();
  const toast = useToast();
  const columns = tab === "discounts" ? [
    { key: "name", label: "Campaign" },
    { key: "scope", label: "Scope" },
    { key: "type", label: "Offer" },
    { key: "value", label: "Value" },
    { key: "startsAt", label: "Starts" },
    { key: "endsAt", label: "Ends" },
    { key: "isActive", label: "State", render: (row: Row) => status(row.isActive ? "Active" : "Inactive") },
    { key: "actions", label: "Action", render: (row: Row) => <><button className="text-button" onClick={() => { setEditing(row); setCreateOpen(true); }}>Edit</button><button className="text-button" onClick={async () => { try { await adminApi.patch(`/discounts/${row._id}`, { isActive: !row.isActive }); toast(row.isActive ? "Discount deactivated." : "Discount activated."); await queryClient.invalidateQueries({ queryKey: ["admin"] }); } catch (error) { toast(error instanceof Error ? error.message : "Discount could not be updated.", "error"); } }}>{row.isActive ? "Deactivate" : "Activate"}</button></> },
  ] : [
    { key: "code", label: "Coupon code" }, { key: "type", label: "Type" }, { key: "value", label: "Value" },
    { key: "usedCount", label: "Used" }, { key: "usageLimit", label: "Usage limit" }, { key: "expiresAt", label: "Expires" },
    { key: "isActive", label: "State", render: (row: Row) => status(row.isActive ? "Active" : "Inactive") },
    { key: "actions", label: "Action", render: (row: Row) => <><button className="text-button" onClick={() => { setEditing(row); setCreateOpen(true); }}>Edit</button><button className="text-button" onClick={async () => { try { await adminApi.patch(`/coupons/${row._id}`, { isActive: !row.isActive }); toast(row.isActive ? "Coupon deactivated." : "Coupon activated."); await queryClient.invalidateQueries({ queryKey: ["admin"] }); } catch (error) { toast(error instanceof Error ? error.message : "Coupon could not be updated.", "error"); } }}>{row.isActive ? "Deactivate" : "Activate"}</button></> },
  ];
  return <>
    <PageHeader eyebrow="PROMOTIONS" title="Discounts & coupons" description="Manage automatic offers and customer redemption codes." actions={<button className="primary-button" onClick={() => { setEditing(null); setCreateOpen(true); }}><Plus size={16} />Create {tab === "discounts" ? "discount" : "coupon"}</button>} />
    <div className="tabs" role="tablist"><button className={tab === "discounts" ? "tab-active" : ""} onClick={() => { setTab("discounts"); setEditing(null); setCreateOpen(false); setPage(1); }}>Automatic discounts</button><button className={tab === "coupons" ? "tab-active" : ""} onClick={() => { setTab("coupons"); setEditing(null); setCreateOpen(false); setPage(1); }}>Coupons</button></div>
    <DataTable rows={query.data?.items ?? []} columns={columns} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} />
    {query.data && <Pagination page={page} limit={PAGE_SIZE} total={query.data.total} setPage={setPage} />}
    {createOpen && (tab === "discounts" ? <DiscountForm record={editing ?? undefined} onClose={() => { setCreateOpen(false); setEditing(null); }} /> : <CouponForm record={editing ?? undefined} onClose={() => { setCreateOpen(false); setEditing(null); }} />)}
  </>;
}

function DiscountForm({ record, onClose }: { record?: Row; onClose(): void }) {
  const localDateTime = (value: unknown) => {
    if (!value) return "";
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  const form = useForm<DiscountFields>({
    resolver: zodResolver(discountSchema),
    defaultValues: record ? {
      name: String(record.name ?? ""), scope: String(record.scope ?? "sitewide") as DiscountFields["scope"],
      targets: Array.isArray(record.targets) ? record.targets.join(", ") : "", type: String(record.type ?? "percent") as DiscountFields["type"],
      value: Number(record.value ?? 10), maxDiscount: record.maxDiscount === undefined ? undefined : Number(record.maxDiscount),
      startsAt: localDateTime(record.startsAt), endsAt: localDateTime(record.endsAt), priority: Number(record.priority ?? 0),
      isActive: Boolean(record.isActive), isFlashSale: Boolean(record.isFlashSale), stackable: Boolean(record.stackable),
    } : { name: "", scope: "sitewide", targets: "", type: "percent", value: 10, maxDiscount: undefined, startsAt: new Date().toISOString().slice(0, 16), endsAt: "", priority: 0, isActive: true, isFlashSale: false, stackable: false },
  });
  const queryClient = useQueryClient();
  const toast = useToast();
  const scope = useWatch({ control: form.control, name: "scope" });
  return <div className="modal-scrim"><form className="modal-card wide-modal" onSubmit={form.handleSubmit(async (values) => {
    try {
      const payload = { ...values, targets: values.scope === "sitewide" ? [] : values.targets?.split(",").map((target) => target.trim()).filter(Boolean), startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString() };
      if (record) await adminApi.patch(`/discounts/${record._id}`, payload);
      else await adminApi.post("/discounts", payload);
      toast(record ? "Discount updated." : "Discount created."); await queryClient.invalidateQueries({ queryKey: ["admin"] }); onClose();
    } catch (error) { form.setError("root", { message: error instanceof Error ? error.message : "Discount could not be saved." }); }
  })}>
    <span className="eyebrow">{record ? "EDIT PROMOTION" : "NEW PROMOTION"}</span><h2>{record ? "Edit discount" : "Create discount"}</h2>
    <div className="form-grid">
      <label>Name<input {...form.register("name")} /></label>
      <label>Scope<select {...form.register("scope")}><option value="sitewide">Sitewide</option><option value="product">Product</option><option value="category">Category</option><option value="collection">Collection</option></select></label>
      {scope !== "sitewide" && <label>Targets (comma-separated)<input {...form.register("targets")} placeholder="e.g. saree, product-id" /></label>}
      <label>Discount type<select {...form.register("type")}><option value="percent">Percentage</option><option value="flat">Flat amount</option></select></label>
      <label>Value<input type="number" min="1" step="0.01" {...form.register("value")} /></label>
      <label>Maximum discount<input type="number" min="0" step="0.01" {...form.register("maxDiscount")} /></label>
      <label>Start date/time<input type="datetime-local" {...form.register("startsAt")} /></label>
      <label>End date/time<input type="datetime-local" {...form.register("endsAt")} /></label>
      <label>Priority<input type="number" min="0" {...form.register("priority")} /></label>
      <label className="checkbox-label"><input type="checkbox" {...form.register("isActive")} />Active</label>
      <label className="checkbox-label"><input type="checkbox" {...form.register("isFlashSale")} />Flash sale</label>
      <label className="checkbox-label"><input type="checkbox" {...form.register("stackable")} />Can stack with other offers</label>
    </div>
    {form.formState.errors.root && <p className="field-error">{form.formState.errors.root.message}</p>}
    {Object.values(form.formState.errors).map((error, index) => error?.message && <p className="field-error" key={index}>{error.message}</p>)}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">{record ? "Save discount" : "Create discount"}</button></div>
  </form></div>;
}

const couponSchema = z.object({ code: z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/), type: z.enum(["percent", "flat"]), value: z.coerce.number().positive(), minOrder: z.coerce.number().min(0), maxDiscount: z.coerce.number().min(0).optional(), expiresAt: z.string().min(1), usageLimit: z.coerce.number().int().min(1), perUserLimit: z.coerce.number().int().min(1), isActive: z.boolean() }).superRefine((value, context) => {
  if (value.type === "percent" && (value.value < 1 || value.value > 90)) context.addIssue({ code: "custom", message: "Percentage must be between 1 and 90.", path: ["value"] });
});
function CouponForm({ record, onClose }: { record?: Row; onClose(): void }) {
  const couponDateTime = (value: unknown) => {
    if (!value) return "";
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  const form = useForm({ resolver: zodResolver(couponSchema), defaultValues: record ? {
    code: String(record.code ?? ""), type: String(record.type ?? "percent") as "percent" | "flat", value: Number(record.value ?? 10),
    minOrder: Number(record.minOrder ?? 0), maxDiscount: record.maxDiscount === undefined ? undefined : Number(record.maxDiscount),
    expiresAt: couponDateTime(record.expiresAt), usageLimit: Number(record.usageLimit ?? 100), perUserLimit: Number(record.perUserLimit ?? 1), isActive: Boolean(record.isActive),
  } : { code: "", type: "percent" as const, value: 10, minOrder: 0, maxDiscount: undefined, expiresAt: "", usageLimit: 100, perUserLimit: 1, isActive: true } });
  const couponType = useWatch({ control: form.control, name: "type" });
  const queryClient = useQueryClient();
  const toast = useToast();
  return <div className="modal-scrim"><form className="modal-card wide-modal" onSubmit={form.handleSubmit(async (values) => {
    try {
      const payload = { ...values, code: values.code.toUpperCase(), expiresAt: new Date(values.expiresAt).toISOString() };
      if (record) await adminApi.patch(`/coupons/${record._id}`, payload);
      else await adminApi.post("/coupons", payload);
      toast(record ? "Coupon updated." : "Coupon created."); await queryClient.invalidateQueries({ queryKey: ["admin"] }); onClose();
    } catch (error) { form.setError("root", { message: error instanceof Error ? error.message : "Coupon could not be saved." }); }
  })}>
    <span className="eyebrow">{record ? "EDIT COUPON" : "NEW COUPON"}</span><h2>{record ? "Edit coupon" : "Create coupon"}</h2>
    <div className="form-grid">
      <label>Coupon code<input {...form.register("code")} /></label>
      <label>Type<select {...form.register("type")}><option value="percent">Percentage</option><option value="flat">Flat amount</option></select></label>
      <label>Value<input type="number" step="0.01" min="1" max={couponType === "percent" ? 90 : undefined} {...form.register("value")} /></label>
      <label>Minimum order<input type="number" step="0.01" min="0" {...form.register("minOrder")} /></label>
      <label>Maximum discount<input type="number" step="0.01" min="0" {...form.register("maxDiscount")} /></label>
      <label>Expires<input type="datetime-local" {...form.register("expiresAt")} /></label>
      <label>Total redemption limit<input type="number" min="1" {...form.register("usageLimit")} /></label>
      <label>Per-customer limit<input type="number" min="1" {...form.register("perUserLimit")} /></label>
      <label className="checkbox-label"><input type="checkbox" {...form.register("isActive")} />Active</label>
    </div>
    {form.formState.errors.root && <p className="field-error">{form.formState.errors.root.message}</p>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">{record ? "Save coupon" : "Create coupon"}</button></div>
  </form></div>;
}

export function MessagesPage() {
  const [filter, setFilter] = useState<"all" | "new" | "read" | "resolved">("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy: "createdAt", sortOrder });
  if (filter !== "all") params.set("status", filter);
  if (search.trim()) params.set("search", search.trim());
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = useQuery({
    queryKey: ["admin", "messages", filter, search, from, to, sortOrder, page],
    queryFn: () => adminApi.get<PageResult<ContactMessage>>(`/messages?${params}`),
  });
  const detailQuery = useQuery({
    queryKey: ["admin", "message", selectedId],
    queryFn: async () => (await adminApi.get<{ item: ContactMessage }>(`/messages/${selectedId}`)).item,
    enabled: Boolean(selectedId),
  });
  const item = detailQuery.data;
  const admin = useAdmin().data;
  const canDelete = admin?.role === "superadmin" || admin?.role === "manager";
  useEffect(() => {
    if (item) {
      void queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "messages", "unread-count"] });
    }
  }, [item, queryClient]);

  async function updateStatus(nextStatus: MessageStatus) {
    if (!item) return;
    try {
      const result = await adminApi.patch<{ item: ContactMessage }>(`/messages/${item._id}/status`, { status: nextStatus });
      queryClient.setQueryData(["admin", "message", item._id], result.item);
      toast(nextStatus === "resolved" ? "Message resolved." : nextStatus === "read" ? "Message marked as read." : "Message reopened.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "messages", "unread-count"] });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update message.", "error");
    }
  }

  return <>
    <PageHeader eyebrow="CUSTOMER CARE" title="Messages" description="Review contact form messages and follow up with customers." />
    <div className="message-toolbar">
      <SearchField value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search name, email, or subject…" />
      <label>From <input aria-label="Messages from date" type="date" className="filter-select" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
      <label>To <input aria-label="Messages to date" type="date" className="filter-select" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
      <button className="secondary-button" onClick={() => setSortOrder((value) => value === "desc" ? "asc" : "desc")}>Date {sortOrder === "desc" ? "newest first" : "oldest first"}</button>
    </div>
    <div className="message-filters" role="group" aria-label="Filter messages by status">
      {(["all", "new", "read", "resolved"] as const).map((value) => <button
        key={value}
        className={filter === value ? "primary-button" : "secondary-button"}
        aria-pressed={filter === value}
        onClick={() => { setFilter(value); setPage(1); }}
      >{value === "all" ? "All" : value === "new" ? "New" : value[0]!.toUpperCase() + value.slice(1)}</button>)}
    </div>
    <div className="message-workspace">
      <section className="panel message-list" aria-label="Customer messages">
        {query.isLoading ? <SkeletonRows /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : !query.data?.items.length
          ? <EmptyState title="Inbox is clear" message="Customer messages matching these filters will appear here." />
          : query.data.items.map((message) => <button
            key={message._id}
            className={`message-list-item ${message._id === selectedId ? "message-selected" : ""}`}
            onClick={() => setSelectedId(message._id)}
          >
            <span className="message-list-heading"><b style={{ fontWeight: messageStatus(message) === "new" ? 750 : 500 }}>{message.name}</b>{status(messageStatus(message))}</span>
            <strong style={{ fontWeight: messageStatus(message) === "new" ? 700 : 500 }}>{message.subject || "Customer enquiry"}</strong>
            <span>{message.email}</span>
            <small>{new Date(message.createdAt).toLocaleString()}</small>
          </button>)}
        {query.data && <Pagination page={page} limit={query.data.limit} total={query.data.total} setPage={setPage} />}
      </section>
      <section className="panel message-detail" aria-label="Message details">
        {!selectedId ? <EmptyState title="Select a message" message="Choose a message to read and respond." />
          : detailQuery.isLoading ? <SkeletonRows count={5} />
            : detailQuery.error ? <ErrorState error={detailQuery.error} retry={() => void detailQuery.refetch()} />
              : item ? <MessageDetailPanel
                key={item._id}
                item={item}
                canDelete={canDelete}
                onStatus={updateStatus}
                onDelete={async () => {
                  await adminApi.delete(`/messages/${item._id}`);
                  setSelectedId("");
                  await queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
                  await queryClient.invalidateQueries({ queryKey: ["admin", "messages", "unread-count"] });
                  toast("Message deleted.");
                }}
              /> : null}
      </section>
    </div>
  </>;
}

function MessageDetailPanel({
  item,
  canDelete,
  onStatus,
  onDelete,
}: {
  item: ContactMessage;
  canDelete: boolean;
  onStatus: (status: MessageStatus) => void;
  onDelete: () => Promise<void>;
}) {
  const [note, setNote] = useState(item.adminNote ?? "");
  const queryClient = useQueryClient();
  const toast = useToast();

  async function saveNote() {
    try {
      const result = await adminApi.patch<{ item: ContactMessage }>(`/messages/${item._id}/note`, { adminNote: note });
      queryClient.setQueryData(["admin", "message", item._id], result.item);
      toast("Internal note saved.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the note.", "error");
    }
  }

  return <>
    <div className="message-detail-heading">
      <div><span className="eyebrow">CUSTOMER MESSAGE</span><h2>{item.subject || "Customer enquiry"}</h2></div>
      {status(messageStatus(item))}
    </div>
    <dl className="detail-pairs"><dt>From</dt><dd>{item.name}</dd><dt>Email</dt><dd><a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a></dd><dt>Received</dt><dd>{new Date(item.createdAt).toLocaleString()}</dd></dl>
    <p className="message-body">{item.message}</p>
    <div className="message-actions">
      {messageStatus(item) === "new" && <button className="secondary-button" onClick={() => onStatus("read")}>Mark as read</button>}
      {messageStatus(item) !== "resolved"
        ? <button className="primary-button" onClick={() => onStatus("resolved")}>Mark resolved</button>
        : <button className="secondary-button" onClick={() => onStatus("read")}>Reopen</button>}
      <a className="secondary-button" href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(`Re: ${item.subject || "Your message to Iyalvi"}`)}`}><Mail size={15} />Reply by email</a>
      <a className="secondary-button" href={`https://wa.me/?text=${encodeURIComponent(`Hi ${item.name}, thank you for contacting Iyalvi. ${item.message}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} />Reply on WhatsApp</a>
      {canDelete && <ConfirmAction
        label="Delete"
        title="Delete this message?"
        description="This permanently removes the customer message."
        destructive
        onConfirm={onDelete}
      />}
    </div>
    <div className="message-note">
      <label htmlFor="message-note">Internal note</label>
      <textarea id="message-note" rows={4} value={note} onChange={(event) => setNote(event.target.value)} maxLength={3000} />
      <div><small>Visible only to administrators.</small><button className="primary-button" onClick={() => void saveNote()}>Save note</button></div>
    </div>
  </>;
}

export function AuditPage() {
  const columns = [
    { key: "actorEmail", label: "Administrator" }, { key: "action", label: "Action" }, { key: "targetType", label: "Record type" },
    { key: "targetId", label: "Record ID" }, { key: "ip", label: "IP address" }, { key: "createdAt", label: "When" },
  ];
  return <ListingPage title="Audit log" subtitle="An immutable history of administrative changes." path="/audit-logs" columns={columns} allowSearch={false} />;
}

export function ReportsPage() {
  return <>
    <PageHeader eyebrow="ANALYTICS" title="Reports" description="Download store data for reconciliations and reporting." />
    <div className="report-grid">
      <article className="report-card"><span className="report-icon"><PackageCheck size={20} /></span><h2>Orders export</h2><p>Download up to 10,000 orders as a CSV file, including order status, payment, customer, and total.</p><DownloadButton path="/exports/orders.csv" filename="iyalvi-orders.csv" label="Download CSV" /></article>
      <article className="report-card"><span className="report-icon"><Activity size={20} /></span><h2>Sales overview</h2><p>Review daily sales and revenue by category on the dashboard.</p><Link to="/" className="secondary-button">Open dashboard</Link></article>
      <article className="report-card"><span className="report-icon"><TicketPercent size={20} /></span><h2>Discount performance</h2><p>Inspect automatic discount campaigns and active coupon limits.</p><Link to="/discounts" className="secondary-button">Open promotions</Link></article>
    </div>
  </>;
}

type MessageStatus = "new" | "read" | "resolved";
type ContactMessage = {
  _id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status?: MessageStatus;
  isRead?: boolean;
  isResolved?: boolean;
  adminNote?: string;
  createdAt: string;
};

function messageStatus(message: ContactMessage): MessageStatus {
  return message.status ?? (message.isResolved ? "resolved" : message.isRead ? "read" : "new");
}