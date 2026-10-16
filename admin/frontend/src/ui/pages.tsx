import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Activity, ArrowDownToLine, ArrowLeft, Boxes, CircleDollarSign, ClipboardList,
  FileText, ImagePlus, PackageCheck, Plus, RefreshCw, ShoppingBag, TicketPercent, UsersRound,
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
  return <ListingPage title="Orders" subtitle="Track fulfilment, review payment status, and open each order." path="/orders" queryFilters={statusFilter ? { status: statusFilter } : {}} columns={options} details={(row) => `/orders/${row._id}`} action={<><select aria-label="Filter by order status" className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{["placed", "packed", "shipped", "delivered", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select><DownloadButton path="/exports/orders.csv" filename="iyalvi-orders.csv" label="Export" /></>} />;
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
        <div className="detail-pairs"><span>Payment</span><b>{formatValue(order.paymentMethod)} · {formatValue(order.paymentStatus)}</b><span>Order total</span><b>{money(order.total)}</b><span>Tracking</span><b>{formatValue(order.trackingNumber)} {order.courier ? `(${formatValue(order.courier)})` : ""}</b></div>
        <div className="table-scroll"><table><thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Unit price</th></tr></thead><tbody>{(order.items ?? []).map((item, index) => <tr key={String(item.product ?? index)}><td>{formatValue(item.name)}</td><td>{formatValue(item.size)}</td><td>{formatValue(item.qty)}</td><td>{money(item.unitPrice)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="panel"><h2>Update order</h2><p className="muted-copy">Add a fulfilment update or an internal note.</p>
        {canManage && order.orderStatus !== "cancelled" && order.orderStatus !== "delivered" && <div className="form-grid"><label>Internal note<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Visible only to staff" /></label><label>Courier<input value={courier} onChange={(event) => setCourier(event.target.value)} /></label><label>Tracking number<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></label>
          <div className="action-row">
            {({ placed: "packed", packed: "shipped", shipped: "delivered" } as Record<string, string>)[order.orderStatus] && <button className="primary-button" onClick={() => mutation.mutate({ path: `/orders/${id}/status`, body: { status: ({ placed: "packed", packed: "shipped", shipped: "delivered" } as Record<string, string>)[order.orderStatus], ...(note ? { note } : {}) } })}>Mark {({ placed: "packed", packed: "shipped", shipped: "delivered" } as Record<string, string>)[order.orderStatus]}</button>}
            <button className="secondary-button" disabled={!courier || !trackingNumber} onClick={() => mutation.mutate({ path: `/orders/${id}/tracking`, body: { courier, trackingNumber } })}>Save tracking</button>
            <button className="secondary-button" disabled={!note.trim()} onClick={() => mutation.mutate({ path: `/orders/${id}/notes`, body: { note }, method: "post" })}>Add note</button>
          </div>
        </div>}
        {canManage && order.orderStatus !== "cancelled" && order.orderStatus !== "delivered" && <ConfirmAction label="Cancel order" title="Cancel this order?" description="This changes the order state and is recorded in the audit log." destructive onConfirm={async () => { await adminApi.post(`/orders/${id}/cancel`, { note: note.trim() || "Cancelled by administrator" }); toast("Order cancelled."); void queryClient.invalidateQueries({ queryKey: ["admin"] }); void query.refetch(); }} />}
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
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (statusFilter) params.set("status", statusFilter);
  const query = useQuery({ queryKey: ["admin", "payments", statusFilter, page], queryFn: () => adminApi.get<PageResult<Row> & { totalsByMethod: Row[]; pendingCodAmount: number; pendingCodOrders: number }>(`/payments?${params}`) });
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
    <PageHeader eyebrow="FINANCE" title="Payments" description="Review order payment methods, statuses, and refund activity." actions={<select className="filter-select" aria-label="Filter payments" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All payments</option>{["pending", "paid", "failed", "refunded"].map((value) => <option key={value}>{value}</option>)}</select>} />
    <div className="metric-grid three-metrics"><Metric title="COD pending" value={money(query.data?.pendingCodAmount)} icon={<CircleDollarSign size={18} />} /><Metric title="COD orders awaiting collection" value={query.data?.pendingCodOrders} icon={<PackageCheck size={18} />} /><Metric title="Payment methods" value={query.data?.totalsByMethod?.length ?? 0} icon={<ClipboardList size={18} />} /></div>
    <DataTable rows={query.data?.items ?? []} columns={columns} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} />
    {query.data && <Pagination page={page} limit={PAGE_SIZE} total={query.data.total} setPage={setPage} />}
    {selected && <div className="modal-scrim"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="refund-heading"><h2 id="refund-heading">Record a refund</h2><p>Refund amounts are limited to the original payment total.</p><div className="form-grid"><label>Amount (₹)<input type="number" min="0.01" step="0.01" max={Number(selected.total)} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Reason<input value={note} onChange={(event) => setNote(event.target.value)} /></label></div><div className="modal-actions"><button className="secondary-button" onClick={() => setSelected(null)}>Close</button><button className="primary-button" disabled={!Number(amount) || !note.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : "Confirm refund"}</button></div></section></div>}
  </>;
}

const productFormSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens"),
  sku: z.string().trim().optional(),
  description: z.string().max(5000).default(""),
  category: z.enum(["saree", "kurti"]),
  subCategory: z.string().trim().min(1),
  fabric: z.string().trim().min(1),
  occasion: z.string().trim().min(1),
  colors: z.string().trim().min(1, "At least one colour is required"),
  sizes: z.string().trim().min(1, "Enter size and stock, for example Free Size:10"),
  price: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).optional(),
  tags: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
});
type ProductInput = z.input<typeof productFormSchema>;
type ProductFields = z.output<typeof productFormSchema>;
type Product = Row & { images?: Array<{ url: string; key: string; alt?: string; isPrimary: boolean }>; sizes?: Array<{ size: string; stock: number }>; colors?: string[]; tags?: string[] };

export function ProductsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const columns = [
    { key: "name", label: "Product" },
    { key: "sku", label: "SKU" },
    { key: "category", label: "Category" },
    { key: "price", label: "Price", render: (row: Row) => money(row.price) },
    { key: "stock", label: "Stock" },
    { key: "isActive", label: "Status", render: (row: Row) => status(row.isActive ? "Active" : "Inactive") },
    { key: "actions", label: "Action", render: (row: Row) => <button className="text-button" onClick={async () => {
      try {
        await adminApi.patch(`/products/${row._id}`, { isActive: !row.isActive });
        toast(row.isActive ? "Product deactivated." : "Product activated.");
        await queryClient.invalidateQueries({ queryKey: ["admin", "/products"] });
      } catch (error) {
        toast(error instanceof Error ? error.message : "Product status could not be changed.", "error");
      }
    }}>{row.isActive ? "Deactivate" : "Activate"}</button> },
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
  const form = useForm<ProductInput, unknown, ProductFields>({
    resolver: zodResolver(productFormSchema),
    values: query.data ? {
      name: String(query.data.name ?? ""),
      slug: String(query.data.slug ?? ""),
      sku: String(query.data.sku ?? ""),
      description: String(query.data.description ?? ""),
      category: query.data.category === "kurti" ? "kurti" : "saree",
      subCategory: String(query.data.subCategory ?? ""),
      fabric: String(query.data.fabric ?? ""),
      occasion: String(query.data.occasion ?? ""),
      colors: (query.data.colors ?? []).join(", "),
      sizes: (query.data.sizes ?? []).map(({ size, stock }) => `${size}:${stock}`).join(", "),
      price: Number(query.data.price ?? 0),
      mrp: Number(query.data.mrp ?? 0),
      costPrice: query.data.costPrice === undefined ? undefined : Number(query.data.costPrice),
      tags: (query.data.tags ?? []).join(", "),
      isActive: Boolean(query.data.isActive),
      isFeatured: Boolean(query.data.isFeatured),
    } : undefined,
    defaultValues: { name: "", slug: "", sku: "", description: "", category: "saree", subCategory: "", fabric: "", occasion: "", colors: "", sizes: "Free Size:0", price: 0, mrp: 0, tags: "", isActive: true, isFeatured: false },
  });
  const mutation = useMutation({
    mutationFn: async (values: ProductFields) => {
      const sizes = values.sizes.split(",").map((pair) => {
        const [size, stock] = pair.split(":");
        if (!size?.trim() || !Number.isInteger(Number(stock)) || Number(stock) < 0) throw new Error("Sizes must use the format Size:stock, for example S:5, M:3.");
        return { size: size.trim(), stock: Number(stock) };
      });
      const payload = {
        ...values,
        sku: values.sku || undefined,
        colors: values.colors.split(",").map((value) => value.trim()).filter(Boolean),
        tags: (values.tags ?? "").split(",").map((value) => value.trim()).filter(Boolean),
        sizes,
      };
      const saved = isEdit
        ? await adminApi.patch<{ item: Product }>(`/products/${id}`, payload)
        : await adminApi.post<{ item: Product }>("/products", payload);
      const product = saved.item;
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
    { name: "name", label: "Product name" }, { name: "slug", label: "URL slug" }, { name: "sku", label: "SKU" },
    { name: "category", label: "Category", type: "select" }, { name: "subCategory", label: "Sub-category" },
    { name: "fabric", label: "Fabric" }, { name: "occasion", label: "Occasion" }, { name: "colors", label: "Colours (comma-separated)" },
    { name: "sizes", label: "Sizes and stock (Size:stock, comma-separated)" }, { name: "price", label: "Price (₹)", type: "number" },
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
        {type === "select" ? <select {...form.register(name)}><option value="saree">Saree</option><option value="kurti">Kurti</option></select> : <input type={type ?? "text"} step={type === "number" ? "0.01" : undefined} {...form.register(name)} />}
        {form.formState.errors[name] && <small className="field-error">{String(form.formState.errors[name]?.message)}</small>}
      </label>)}
        <label className="checkbox-label"><input type="checkbox" {...form.register("isActive")} />Active in storefront</label>
        <label className="checkbox-label"><input type="checkbox" {...form.register("isFeatured")} />Featured product</label>
        <label className="full-field">Description<textarea rows={4} {...form.register("description")} /></label>
      </div>
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
  if (item.type === "percent" && item.value > 90) context.addIssue({ code: "custom", message: "Percentage must not exceed 90.", path: ["value"] });
  if (item.scope === "sitewide" && item.targets?.trim()) context.addIssue({ code: "custom", message: "Sitewide discounts do not have targets.", path: ["targets"] });
  if (item.scope !== "sitewide" && !item.targets?.trim()) context.addIssue({ code: "custom", message: "Add one or more targets.", path: ["targets"] });
});
type DiscountFields = z.infer<typeof discountSchema>;

export function DiscountsPage() {
  const [tab, setTab] = useState<"discounts" | "coupons">("discounts");
  const [createOpen, setCreateOpen] = useState(false);
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
    { key: "actions", label: "Action", render: (row: Row) => <button className="text-button" onClick={async () => { try { await adminApi.patch(`/discounts/${row._id}`, { isActive: !row.isActive }); toast(row.isActive ? "Discount deactivated." : "Discount activated."); await queryClient.invalidateQueries({ queryKey: ["admin"] }); } catch (error) { toast(error instanceof Error ? error.message : "Discount could not be updated.", "error"); } }}>{row.isActive ? "Deactivate" : "Activate"}</button> },
  ] : [
    { key: "code", label: "Coupon code" }, { key: "type", label: "Type" }, { key: "value", label: "Value" },
    { key: "usedCount", label: "Used" }, { key: "usageLimit", label: "Usage limit" }, { key: "expiresAt", label: "Expires" },
    { key: "isActive", label: "State", render: (row: Row) => status(row.isActive ? "Active" : "Inactive") },
    { key: "actions", label: "Action", render: (row: Row) => <button className="text-button" onClick={async () => { try { await adminApi.patch(`/coupons/${row._id}`, { isActive: !row.isActive }); toast(row.isActive ? "Coupon deactivated." : "Coupon activated."); await queryClient.invalidateQueries({ queryKey: ["admin"] }); } catch (error) { toast(error instanceof Error ? error.message : "Coupon could not be updated.", "error"); } }}>{row.isActive ? "Deactivate" : "Activate"}</button> },
  ];
  return <>
    <PageHeader eyebrow="PROMOTIONS" title="Discounts & coupons" description="Manage automatic offers and customer redemption codes." actions={<button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} />Create {tab === "discounts" ? "discount" : "coupon"}</button>} />
    <div className="tabs" role="tablist"><button className={tab === "discounts" ? "tab-active" : ""} onClick={() => { setTab("discounts"); setPage(1); }}>Automatic discounts</button><button className={tab === "coupons" ? "tab-active" : ""} onClick={() => { setTab("coupons"); setPage(1); }}>Coupons</button></div>
    <DataTable rows={query.data?.items ?? []} columns={columns} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} />
    {query.data && <Pagination page={page} limit={PAGE_SIZE} total={query.data.total} setPage={setPage} />}
    {createOpen && (tab === "discounts" ? <DiscountForm onClose={() => setCreateOpen(false)} /> : <CouponForm onClose={() => setCreateOpen(false)} />)}
  </>;
}

function DiscountForm({ onClose }: { onClose(): void }) {
  const form = useForm<DiscountFields>({
    resolver: zodResolver(discountSchema),
    defaultValues: { name: "", scope: "sitewide", targets: "", type: "percent", value: 10, maxDiscount: undefined, startsAt: new Date().toISOString().slice(0, 16), endsAt: "", priority: 0, isActive: true, isFlashSale: false, stackable: false },
  });
  const queryClient = useQueryClient();
  const toast = useToast();
  const scope = useWatch({ control: form.control, name: "scope" });
  return <div className="modal-scrim"><form className="modal-card wide-modal" onSubmit={form.handleSubmit(async (values) => {
    try {
      await adminApi.post("/discounts", { ...values, targets: values.scope === "sitewide" ? [] : values.targets?.split(",").map((target) => target.trim()).filter(Boolean), startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString() });
      toast("Discount created."); await queryClient.invalidateQueries({ queryKey: ["admin"] }); onClose();
    } catch (error) { form.setError("root", { message: error instanceof Error ? error.message : "Discount could not be created." }); }
  })}>
    <span className="eyebrow">NEW PROMOTION</span><h2>Create discount</h2>
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
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Create discount</button></div>
  </form></div>;
}

const couponSchema = z.object({ code: z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/), type: z.enum(["percent", "flat"]), value: z.coerce.number().positive(), minOrder: z.coerce.number().min(0), maxDiscount: z.coerce.number().min(0).optional(), expiresAt: z.string().min(1), usageLimit: z.coerce.number().int().min(1), perUserLimit: z.coerce.number().int().min(1), isActive: z.boolean() });
function CouponForm({ onClose }: { onClose(): void }) {
  const form = useForm({ resolver: zodResolver(couponSchema), defaultValues: { code: "", type: "percent" as const, value: 10, minOrder: 0, maxDiscount: undefined, expiresAt: "", usageLimit: 100, perUserLimit: 1, isActive: true } });
  const queryClient = useQueryClient();
  const toast = useToast();
  return <div className="modal-scrim"><form className="modal-card wide-modal" onSubmit={form.handleSubmit(async (values) => {
    try {
      await adminApi.post("/coupons", { ...values, code: values.code.toUpperCase(), expiresAt: new Date(values.expiresAt).toISOString() });
      toast("Coupon created."); await queryClient.invalidateQueries({ queryKey: ["admin"] }); onClose();
    } catch (error) { form.setError("root", { message: error instanceof Error ? error.message : "Coupon could not be created." }); }
  })}>
    <span className="eyebrow">NEW COUPON</span><h2>Create coupon</h2>
    <div className="form-grid">
      <label>Coupon code<input {...form.register("code")} /></label>
      <label>Type<select {...form.register("type")}><option value="percent">Percentage</option><option value="flat">Flat amount</option></select></label>
      <label>Value<input type="number" step="0.01" min="0.01" {...form.register("value")} /></label>
      <label>Minimum order<input type="number" step="0.01" min="0" {...form.register("minOrder")} /></label>
      <label>Maximum discount<input type="number" step="0.01" min="0" {...form.register("maxDiscount")} /></label>
      <label>Expires<input type="datetime-local" {...form.register("expiresAt")} /></label>
      <label>Total redemption limit<input type="number" min="1" {...form.register("usageLimit")} /></label>
      <label>Per-customer limit<input type="number" min="1" {...form.register("perUserLimit")} /></label>
      <label className="checkbox-label"><input type="checkbox" {...form.register("isActive")} />Active</label>
    </div>
    {form.formState.errors.root && <p className="field-error">{form.formState.errors.root.message}</p>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Create coupon</button></div>
  </form></div>;
}

export function MessagesPage() {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (filter) params.set("isResolved", filter);
  const query = useQuery({ queryKey: ["admin", "messages", filter, page], queryFn: () => adminApi.get<PageResult<Row>>(`/messages?${params}`) });
  const columns = [
    { key: "name", label: "From" }, { key: "email", label: "Email" }, { key: "message", label: "Message", className: "message-cell" },
    { key: "isRead", label: "Read", render: (row: Row) => status(row.isRead ? "Read" : "Unread") },
    { key: "isResolved", label: "Resolution", render: (row: Row) => status(row.isResolved ? "Resolved" : "Open") },
    { key: "createdAt", label: "Received" },
    { key: "actions", label: "Action", render: (row: Row) => <button className="text-button" onClick={async () => {
      try { await adminApi.patch(`/messages/${row._id}`, { isRead: true, isResolved: !row.isResolved }); toast(row.isResolved ? "Message reopened." : "Message resolved."); await queryClient.invalidateQueries({ queryKey: ["admin", "messages"] }); } catch (error) { toast(error instanceof Error ? error.message : "Could not update message.", "error"); }
    }}>{row.isResolved ? "Reopen" : "Resolve"}</button> },
  ];
  return <>
    <PageHeader eyebrow="CUSTOMER CARE" title="Messages" description="Review contact form messages and follow up with customers." actions={<select className="filter-select" aria-label="Filter messages" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="">All messages</option><option value="false">Open</option><option value="true">Resolved</option></select>} />
    <DataTable rows={query.data?.items ?? []} columns={columns} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} emptyTitle="Inbox is clear" emptyMessage="Customer messages will appear here." />
    {query.data && <Pagination page={page} limit={PAGE_SIZE} total={query.data.total} setPage={setPage} />}
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

export function StaffPage() {
  return <UnavailablePage title="Staff" description="Manage administrator access and staff roles." endpoint="Staff management is not available in the current admin API. Ask your system administrator to provision or update staff accounts." />;
}

export function SettingsPage() {
  return <UnavailablePage title="Settings" description="Store preferences and administrative configuration." endpoint="Settings management is not available in the current admin API. No settings were changed." />;
}

function UnavailablePage({ title, description, endpoint }: { title: string; description: string; endpoint: string }) {
  return <><PageHeader eyebrow="ADMINISTRATION" title={title} description={description} /><section className="panel unavailable-panel"><span className="report-icon"><RefreshCw size={20} /></span><h2>Endpoint not available</h2><p>{endpoint}</p></section></>;
}
