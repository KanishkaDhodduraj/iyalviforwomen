import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/data/products";
import { getAllProducts, type ApiProduct } from "@/lib/api";

type FloatingProduct = {
  id: string;
  slug: string;
  name: string;
  category: "saree" | "kurti";
  price: number;
  mrp: number;
  offerEndsAt?: string;
};
type RotatingProduct = { product: FloatingProduct; isDiscount: boolean };

function timeRemaining(endsAt: string, now: number): string | null {
  const milliseconds = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const clock = [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
  return days ? `${days}d ${clock}` : clock;
}

function toFloatingProduct(product: ApiProduct): FloatingProduct | null {
  if (!product._id || !product.name || !Number.isFinite(product.price)) return null;
  return {
    id: product._id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    price: product.price,
    mrp: Math.max(product.originalPrice ?? 0, product.mrp),
    ...(product.offerEndsAt && { offerEndsAt: product.offerEndsAt }),
  };
}

export function FloatingDiscovery() {
  const [products, setProducts] = useState<FloatingProduct[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        setDismissed(window.sessionStorage.getItem("iyalvi-discovery-dismissed") === "true");
      } catch {
        setDismissed(false);
      }
    }
    let active = true;
    void getAllProducts(new URLSearchParams({ sort: "newest" }))
      .then((result) => {
        if (active)
          setProducts(
            result.map(toFloatingProduct).filter((item): item is FloatingProduct => Boolean(item)),
          );
      })
      .catch(() => {
        if (active) setProducts([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (products.length === 0) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [products.length]);

  const rotatingProducts = useMemo(() => {
    const activeDeals = products.filter((product) => {
      if (product.mrp <= product.price) return false;
      return !product.offerEndsAt || new Date(product.offerEndsAt).getTime() > now;
    });
    return [
      ...products.map((product) => ({ product, isDiscount: false })),
      ...activeDeals.map((product) => ({ product, isDiscount: true })),
    ];
  }, [now, products]);

  useEffect(() => {
    if (rotatingProducts.length < 2) return;
    const rotate = window.setInterval(() => setIndex((value) => value + 1), 6500);
    return () => window.clearInterval(rotate);
  }, [rotatingProducts.length]);

  const current = rotatingProducts.length
    ? rotatingProducts[index % rotatingProducts.length]
    : undefined;
  const product = current?.product;
  const panelProducts = useMemo(() => {
    const unique = new Map<string, RotatingProduct>();
    for (const item of rotatingProducts) {
      const existing = unique.get(item.product.id);
      unique.set(item.product.id, {
        product: item.product,
        isDiscount: item.isDiscount || Boolean(existing?.isDiscount),
      });
    }
    return [...unique.values()].slice(0, 8);
  }, [rotatingProducts]);

  useEffect(() => {
    if (!current?.isDiscount || !product?.offerEndsAt) return;
    const update = () => setNow(Date.now());
    update();
    const countdown = window.setInterval(update, 1000);
    return () => window.clearInterval(countdown);
  }, [current?.isDiscount, product?.offerEndsAt]);

  if (dismissed || !current || !product) return null;
  const discount = current.isDiscount
    ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100))
    : 0;
  const remaining =
    current.isDiscount && product.offerEndsAt && now
      ? timeRemaining(product.offerEndsAt, now)
      : null;
  const href = (item: FloatingProduct) =>
    `${item.category === "saree" ? "/sarees" : "/kurtis"}#product-${encodeURIComponent(item.slug)}`;

  return (
    <aside className="floating-discovery" aria-label="Latest styles and active discounts">
      {expanded ? (
        <div className="floating-discovery-panel">
          <div className="floating-discovery-panel-heading">
            <div>
              <span className="eyebrow">JUST FOR YOU</span>
              <strong>New styles & active offers</strong>
            </div>
            <Button
              className="floating-discovery-close"
              variant="ghost"
              size="icon"
              aria-label="Hide this card for this session"
              onClick={() => {
                if (typeof window !== "undefined") {
                  try {
                    window.sessionStorage.setItem("iyalvi-discovery-dismissed", "true");
                  } catch {
                    // The in-memory dismissal still applies when storage is blocked.
                  }
                }
                setDismissed(true);
              }}
            >
              <X />
            </Button>
          </div>
          <ul className="floating-discovery-list">
            {panelProducts.map(({ product: item, isDiscount }) => {
              const percent = isDiscount
                ? Math.max(0, Math.round((1 - item.price / item.mrp) * 100))
                : 0;
              return (
                <li key={item.id}>
                  <Link
                    to={item.category === "saree" ? "/sarees" : "/kurtis"}
                    hash={`product-${item.slug}`}
                    onClick={() => setExpanded(false)}
                  >
                    <span>{item.name}</span>
                    <span className="floating-discovery-price">
                      {percent > 0 && <b>{percent}% OFF</b>}
                      {formatPrice(item.price)}
                    </span>
                    {isDiscount && item.offerEndsAt && (
                      <small>
                        {timeRemaining(item.offerEndsAt, now)
                          ? `Ends in ${timeRemaining(item.offerEndsAt, now)}`
                          : "Offer ended"}
                      </small>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="floating-discovery-footnote">A few favourites, refreshed as you browse.</p>
          <Button
            className="floating-discovery-minimize"
            variant="ghost"
            onClick={() => setExpanded(false)}
          >
            Close
          </Button>
        </div>
      ) : (
        <Button className="floating-discovery-trigger" onClick={() => setExpanded(true)}>
          <span className="floating-discovery-trigger-label">
            {current.isDiscount ? `${discount}% OFF` : "JUST ARRIVED"}
          </span>
          <strong>{product.name}</strong>
          <span>{formatPrice(product.price)}</span>
          {remaining && (
            <small>
              <Clock3 /> {remaining}
            </small>
          )}
        </Button>
      )}
    </aside>
  );
}
