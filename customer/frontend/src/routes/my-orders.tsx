import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/iyalvi/motifs";
import { CustomerNavLink } from "@/components/iyalvi/customer-nav-link";
import { customerNavigation } from "@/lib/customer-navigation";
import { api, type ApiOrder } from "@/lib/api";
import { useCustomerTheme } from "@/hooks/use-customer-theme";
import { usePrototype } from "@/data/store";

export const Route = createFileRoute("/my-orders")({
  head: () => ({ meta: [{ title: "My Orders — IYALVI" }] }),
  component: MyOrdersPage,
});

const progress = [
  ["placed", "Placed"],
  ["packed", "Packed"],
  ["shipped", "Shipped"],
  ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"],
] as const;

function MyOrdersPage() {
  useCustomerTheme();
  const customer = usePrototype((state) => state.customer);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!customer) return;
    try {
      const result = await api.get<{ orders: ApiOrder[] }>("/orders?limit=50");
      setOrders(result.orders);
      setError("");
      if (selectedId) {
        const detail = await api.get<{ order: ApiOrder }>(`/orders/${selectedId}`);
        setSelected(detail.order);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [customer, selectedId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let active = true;
    void api
      .get<{ order: ApiOrder }>(`/orders/${selectedId}`)
      .then(({ order }) => {
        if (active) setSelected(order);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Order details could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  return (
    <div className="iyalvi-app customer-orders-page">
      <header className="site-header customer-site-header">
        <div className="header-main page-width">
          <Link to="/" className="brand-home" aria-label="IYALVI home" replace>
            <Brand compact />
          </Link>
        </div>
        <nav className="desktop-nav customer-primary-nav" aria-label="Main navigation">
          {customerNavigation.map((item) => (
            <CustomerNavLink key={item.to} to={item.to}>
              {item.label}
            </CustomerNavLink>
          ))}
        </nav>
      </header>
      <main className="community-page-content page-width my-orders-layout">
        <section className="community-page-heading">
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>My Orders</h1>
          <p>Order progress refreshes from your live account.</p>
        </section>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!customer && <p className="empty-state">Sign in to view your orders.</p>}
        {loading && customer && (
          <p className="empty-state" role="status">
            Loading your orders…
          </p>
        )}
        {!loading && customer && orders.length === 0 && (
          <p className="empty-state">No orders yet.</p>
        )}
        {orders.length > 0 && (
          <div className="my-orders-grid">
            <div className="my-orders-list" aria-label="Your orders">
              {orders.map((order) => (
                <button
                  type="button"
                  key={order._id}
                  aria-pressed={selectedId === order._id}
                  onClick={() => setSelectedId(order._id)}
                >
                  <strong>Order {order._id.slice(-8).toUpperCase()}</strong>
                  <span>
                    {new Date(order.createdAt).toLocaleDateString()} · ₹
                    {order.total.toLocaleString("en-IN")}
                  </span>
                  <small>{order.orderStatus.replaceAll("_", " ")}</small>
                </button>
              ))}
            </div>
            {selected && (
              <section className="my-order-detail">
                <h2>Order {selected._id.slice(-8).toUpperCase()}</h2>
                {selected.orderStatus === "cancelled" ? (
                  <p className="order-status-cancelled">Cancelled</p>
                ) : (
                  <ol className="my-order-progress">
                    {progress.map(([key, label]) => {
                      const history = selected.statusHistory?.find((entry) => entry.status === key);
                      const complete =
                        progress.findIndex(([status]) => status === selected.orderStatus) >=
                        progress.findIndex(([status]) => status === key);
                      return (
                        <li className={complete ? "is-complete" : ""} key={key}>
                          <span aria-hidden="true" />
                          <strong>{label}</strong>
                          {history && (
                            <time dateTime={history.at}>
                              {new Date(history.at).toLocaleString()}
                            </time>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {selected.courier && (
                  <p>
                    <b>Courier:</b> {selected.courier}
                  </p>
                )}
                {selected.trackingNumber && (
                  <p>
                    <b>Tracking number:</b> {selected.trackingNumber}
                  </p>
                )}
                {selected.statusHistory
                  ?.slice()
                  .reverse()
                  .find((entry) => entry.note)?.note && (
                  <p>
                    <b>Latest update:</b>{" "}
                    {
                      selected.statusHistory
                        .slice()
                        .reverse()
                        .find((entry) => entry.note)?.note
                    }
                  </p>
                )}
                <h3>Items</h3>
                <ul>
                  {selected.items.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      {item.name} · {item.size} · {item.qty} × ₹
                      {item.unitPrice.toLocaleString("en-IN")}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
