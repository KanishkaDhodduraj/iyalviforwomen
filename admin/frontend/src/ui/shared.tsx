import { createContext, useContext, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, ChevronLeft, ChevronRight, LoaderCircle, Search, X } from "lucide-react";

type ToastMessage = { id: number; text: string; kind: "success" | "error" };
const ToastContext = createContext<(text: string, kind?: ToastMessage["kind"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const notify = (text: string, kind: ToastMessage["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current, { id, text, kind }]);
    window.setTimeout(() => setMessages((current) => current.filter((message) => message.id !== id)), 4000);
  };
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite">{messages.map((message) => (
        <div key={message.id} className={`toast toast-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.kind === "error" ? <AlertCircle size={17} /> : <Check size={17} />}{message.text}
          <button aria-label="Dismiss notification" onClick={() => setMessages((current) => current.filter((item) => item.id !== message.id))}><X size={15} /></button>
        </div>
      ))}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function LoadingState({ label = "Loading records" }: { label?: string }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" size={20} />{label}</div>;
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return <div className="skeleton-rows" aria-label="Loading records">{Array.from({ length: count }, (_, index) => <div key={index} />)}</div>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><div className="empty-icon"><Search size={22} /></div><h3>{title}</h3><p>{message}</p></div>;
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : "Could not load this section.";
  return <div className="error-banner" role="alert"><AlertCircle size={17} />{message}{retry && <button className="text-button" onClick={retry}>Retry</button>}</div>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-heading section-page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}<span className="heading-dot">.</span></h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

export function SearchField({ value, onChange, placeholder = "Search records…" }: { value: string; onChange(value: string): void; placeholder?: string }) {
  return <label className="search-box"><Search size={17} /><input aria-label="Search records" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function DataTable<T extends Record<string, unknown>>({
  rows, columns, loading, error, emptyTitle, emptyMessage, rowLink, onRetry,
}: {
  rows: T[];
  columns: Array<{ key: string; label: string; render?: (row: T) => ReactNode; className?: string }>;
  loading?: boolean;
  error?: unknown;
  emptyTitle?: string;
  emptyMessage?: string;
  rowLink?: (row: T) => string | undefined;
  onRetry?: () => void;
}) {
  if (loading) return <section className="table-card"><SkeletonRows /></section>;
  if (error) return <ErrorState error={error} retry={onRetry} />;
  if (!rows.length) return <section className="table-card"><EmptyState title={emptyTitle ?? "Nothing to show yet"} message={emptyMessage ?? "Records will appear here when available."} /></section>;
  return (
    <section className="table-card"><div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>
      {rows.map((row, index) => {
        const href = rowLink?.(row);
        const rowId = String(row._id ?? row.id ?? index);
        return <tr key={rowId}>{columns.map((column) => <td key={column.key} className={column.className}>{href && column === columns[0] ? <Link className="table-link" to={href}>{column.render ? column.render(row) : formatValue(row[column.key])}</Link> : column.render ? column.render(row) : formatValue(row[column.key])}</td>)}</tr>;
      })}
    </tbody></table></div></section>
  );
}

export function Pagination({ page, limit, total, setPage }: { page: number; limit: number; total: number; setPage(page: number): void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return <div className="pagination"><span>{total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : "0 records"}</span><div><button disabled={page <= 1} aria-label="Previous page" onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span>Page {page} of {pages}</span><button disabled={page >= pages} aria-label="Next page" onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div></div>;
}

export function ConfirmAction({ label, title, description, onConfirm, destructive = false }: { label: string; title: string; description: string; onConfirm(): void | Promise<void>; destructive?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true);
    setError("");
    try { await onConfirm(); setOpen(false); } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The requested action could not be completed.");
    } finally { setBusy(false); }
  }
  return <>
    <button className={destructive ? "danger-button" : "secondary-button"} onClick={() => { setError(""); setOpen(true); }}>{label}</button>
    {open && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <button className="modal-close" aria-label="Close confirmation" onClick={() => setOpen(false)}><X size={18} /></button>
        <span className="eyebrow">PLEASE CONFIRM</span><h2 id="confirm-title">{title}</h2><p>{description}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={() => setOpen(false)}>Keep as is</button><button className={destructive ? "danger-button" : "primary-button"} disabled={busy} onClick={() => void confirm()}>{busy ? "Working…" : label}</button></div>
      </section>
    </div>}
  </>;
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-IN");
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).toLocaleString("en-IN");
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(", ");
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (typeof item.name === "string") return item.name;
    if (typeof item.email === "string") return item.email;
    if (typeof item._id === "string") return item._id;
    return "Details";
  }
  return String(value);
}
