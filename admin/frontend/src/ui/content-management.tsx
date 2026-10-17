import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Star } from "lucide-react";
import { adminApi, type PageResult } from "../api";
import {
  ConfirmAction, DataTable, ErrorState, formatValue, PageHeader, Pagination, useToast,
} from "./shared";

const PAGE_SIZE = 25;
const MAX_REORDERABLE_REELS = 500;
const instagramReelUrlSchema = z.string().trim().max(2048).url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "instagram.com" || url.hostname === "www.instagram.com") &&
      !url.port && !url.username && !url.password &&
      /^\/(?:reel|p)\/[A-Za-z0-9_-]{1,20}\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}, "Enter a valid HTTPS Instagram Reels URL.");

export const reelFormSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120),
  instagramUrl: instagramReelUrlSchema,
  order: z.coerce.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
});
type ReelFormValues = z.infer<typeof reelFormSchema>;
type Reel = ReelFormValues & { _id: string; shortcode: string };
type Review = {
  _id: string;
  rating: number;
  text: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: string;
  user?: { name?: string; email?: string } | string;
  product?: { name?: string } | string;
};

async function fetchReels() {
  const first = await adminApi.get<PageResult<Reel>>(`/reels?page=1&limit=100`);
  const pageCount = Math.min(Math.ceil(first.total / 100), MAX_REORDERABLE_REELS / 100);
  const remaining = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
    adminApi.get<PageResult<Reel>>(`/reels?page=${index + 2}&limit=100`),
  ));
  return { items: [ ...first.items, ...remaining.flatMap((page) => page.items) ], total: first.total };
}

export function ReelsPage() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Reel | null | undefined>(undefined);
  const query = useQuery({ queryKey: ["admin", "reels"], queryFn: fetchReels });
  const queryClient = useQueryClient();
  const toast = useToast();
  const reels = query.data?.items ?? [];
  const pageItems = reels.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const save = useMutation({
    mutationFn: async (values: ReelFormValues) => editing
      ? adminApi.patch(`/reels/${editing._id}`, values)
      : adminApi.post("/reels", values),
    onSuccess: async () => {
      toast(editing ? "Reel updated." : "Reel created.");
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ["admin", "reels"] });
    },
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => adminApi.patch("/reels/reorder", { ids }),
    onSuccess: async () => {
      toast("Reel order updated.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "reels"] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Reels could not be reordered.", "error"),
  });

  async function toggleActive(reel: Reel) {
    try {
      await adminApi.post(`/reels/${reel._id}/${reel.isActive ? "deactivate" : "activate"}`);
      toast(reel.isActive ? "Reel deactivated." : "Reel activated.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "reels"] });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Reel status could not be changed.", "error");
    }
  }
  async function deleteReel(reel: Reel) {
    await adminApi.delete(`/reels/${reel._id}`);
    toast("Reel deleted.");
    await queryClient.invalidateQueries({ queryKey: ["admin", "reels"] });
  }
  function moveReel(reel: Reel, offset: -1 | 1) {
    const index = reels.findIndex((item) => item._id === reel._id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= reels.length) return;
    const ids = reels.map((item) => item._id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(ids);
  }

  const columns = [
    { key: "order", label: "Order" },
    { key: "title", label: "Reel" },
    { key: "shortcode", label: "Instagram shortcode" },
    { key: "instagramUrl", label: "Instagram", render: (reel: Reel) => <a className="text-button" href={reel.instagramUrl} target="_blank" rel="noreferrer">Open reel <ExternalLink size={13} /></a> },
    { key: "isActive", label: "State", render: (reel: Reel) => <span className={`status-pill status-${reel.isActive ? "active" : "inactive"}`}>{reel.isActive ? "Active" : "Inactive"}</span> },
    { key: "actions", label: "Actions", render: (reel: Reel) => <div className="content-actions">
      <button className="icon-button" aria-label={`Move ${reel.title} up`} title="Move up" disabled={reorder.isPending || reels.indexOf(reel) === 0} onClick={() => moveReel(reel, -1)}><ArrowUp size={15} /></button>
      <button className="icon-button" aria-label={`Move ${reel.title} down`} title="Move down" disabled={reorder.isPending || reels.indexOf(reel) === reels.length - 1} onClick={() => moveReel(reel, 1)}><ArrowDown size={15} /></button>
      <button className="text-button" onClick={() => setEditing(reel)}><Pencil size={13} /> Edit</button>
      <button className="text-button" onClick={() => void toggleActive(reel)}>{reel.isActive ? "Deactivate" : "Activate"}</button>
      <ConfirmAction label="Delete" title="Delete this reel?" description="This permanently removes the reel from the storefront." destructive onConfirm={() => deleteReel(reel)} />
    </div> },
  ];

  return <>
    <PageHeader eyebrow="STOREFRONT CONTENT" title="Reels" description="Manage Instagram reels shown in your storefront." actions={<button className="primary-button" onClick={() => { save.reset(); setEditing(null); }}><Plus size={16} />Add reel</button>} />
    {query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
    {query.data && query.data.total > MAX_REORDERABLE_REELS && <p className="muted-copy">Showing the first {MAX_REORDERABLE_REELS} reels. Reorder supports up to {MAX_REORDERABLE_REELS} items at a time.</p>}
    <DataTable<Reel> rows={pageItems} columns={columns} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} emptyTitle="No reels yet" emptyMessage="Add an Instagram reel to feature it in your storefront." />
    {query.data && <Pagination page={page} limit={PAGE_SIZE} total={Math.min(query.data.total, reels.length)} setPage={setPage} />}
    {editing !== undefined && <ReelForm reel={editing} defaultOrder={Math.max(0, ...reels.map((reel) => reel.order)) + 1} saving={save.isPending} error={save.error} onClose={() => { save.reset(); setEditing(undefined); }} onSubmit={(values) => save.mutate(values)} />}
  </>;
}

function ReelForm({ reel, defaultOrder, saving, error, onClose, onSubmit }: {
  reel: Reel | null;
  defaultOrder: number;
  saving: boolean;
  error: Error | null;
  onClose(): void;
  onSubmit(values: ReelFormValues): void;
}) {
  const form = useForm<ReelFormValues>({
    resolver: zodResolver(reelFormSchema),
    defaultValues: reel ?? { title: "", instagramUrl: "", order: defaultOrder, isActive: true },
  });
  return <div className="modal-scrim"><form className="modal-card wide-modal" onSubmit={form.handleSubmit(onSubmit)}>
    <span className="eyebrow">{reel ? "EDIT CONTENT" : "NEW CONTENT"}</span><h2>{reel ? "Edit reel" : "Add reel"}</h2>
    <div className="form-grid">
      <label>Title<input {...form.register("title")} maxLength={120} />{form.formState.errors.title && <small className="field-error">{form.formState.errors.title.message}</small>}</label>
      <label>Instagram reel or post link<input type="url" placeholder="https://www.instagram.com/reel/…" {...form.register("instagramUrl")} />{form.formState.errors.instagramUrl && <small className="field-error">{form.formState.errors.instagramUrl.message}</small>}</label>
      <label>Display order<input type="number" min={0} max={1_000_000} step={1} {...form.register("order")} />{form.formState.errors.order && <small className="field-error">{form.formState.errors.order.message}</small>}</label>
      <label className="checkbox-label"><input type="checkbox" {...form.register("isActive")} />Active in storefront</label>
    </div>
    {error && <p className="field-error" role="alert">{error.message}</p>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : reel ? "Save changes" : "Create reel"}</button></div>
  </form></div>;
}

export function ReviewsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (filter) params.set("status", filter);
  const query = useQuery({
    queryKey: ["admin", "reviews", page, filter],
    queryFn: () => adminApi.get<PageResult<Review>>(`/reviews?${params.toString()}`),
  });

  async function updateReview(id: string, action: "approved" | "rejected" | "delete") {
    if (action === "delete") await adminApi.delete(`/reviews/${id}`);
    else await adminApi.post(`/reviews/${id}/${action}`);
    toast(action === "delete" ? "Review deleted." : `Review ${action}.`);
    await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
  }
  async function moderate(id: string, action: "approved" | "rejected") {
    try {
      await updateReview(id, action);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Review could not be updated.", "error");
    }
  }

  const columns = [
    { key: "createdAt", label: "Submitted" },
    { key: "user", label: "Customer", render: (review: Review) => formatValue(review.user) },
    { key: "product", label: "Product", render: (review: Review) => formatValue(review.product) },
    { key: "rating", label: "Rating", render: (review: Review) => <span aria-label={`${review.rating} out of 5 stars`}><Star size={13} fill="currentColor" /> {review.rating}/5</span> },
    { key: "text", label: "Review", className: "message-cell" },
    { key: "status", label: "Status", render: (review: Review) => <span className={`status-pill status-${review.status}`}>{review.status}</span> },
    { key: "actions", label: "Moderation", render: (review: Review) => <div className="content-actions">
      {review.status !== "approved" && <button className="text-button" onClick={() => void moderate(review._id, "approved")}>Approve</button>}
      {review.status !== "rejected" && <button className="text-button" onClick={() => void moderate(review._id, "rejected")}>Reject</button>}
      <ConfirmAction label="Delete" title="Delete this review?" description="This permanently removes the customer review." destructive onConfirm={() => updateReview(review._id, "delete")} />
    </div> },
  ];

  return <>
    <PageHeader eyebrow="CUSTOMER FEEDBACK" title="Reviews" description="Review customer feedback and moderate what appears in your storefront." actions={<label className="filter-label">Status<select aria-label="Filter reviews by status" className="filter-select" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="">All reviews</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>} />
    <DataTable<Review> rows={query.data?.items ?? []} columns={columns} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} emptyTitle="No reviews found" emptyMessage="Customer reviews matching this filter will appear here." />
    {query.data && <Pagination page={page} limit={PAGE_SIZE} total={query.data.total} setPage={setPage} />}
  </>;
}
