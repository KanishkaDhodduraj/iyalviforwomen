import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/iyalvi/motifs";
import { CustomerNavLink } from "@/components/iyalvi/customer-nav-link";
import { ProductCard, ProductDialog, TrunkDialog } from "@/components/iyalvi/discovery";
import type { Product } from "@/data/products";
import { getAllProducts, productFromApi } from "@/lib/api";
import { customerNavigation } from "@/lib/customer-navigation";
import { useCustomerTheme } from "@/hooks/use-customer-theme";

export function NewArrivalsPage() {
  useCustomerTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const [trunk, setTrunk] = useState<"bag" | "wishlist" | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void getAllProducts(new URLSearchParams({ sort: "newest" }))
      .then((result) => {
        if (active) setProducts(result.map(productFromApi));
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "New arrivals could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <div className="iyalvi-app customer-community-page">
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
      <main className="community-page-content page-width">
        <section className="community-page-heading">
          <span className="eyebrow">NEW ARRIVALS</span>
          <h1>Fresh from IYALVI.</h1>
          <p>The latest styles, straight from our collection.</p>
        </section>
        {loading && (
          <p className="empty-state" role="status">
            Loading new arrivals…
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && products.length === 0 && (
          <p className="empty-state">New styles are coming soon.</p>
        )}
        {products.length > 0 && (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={setSelected}
                onAdded={() => setTrunk("bag")}
                notify={setToast}
              />
            ))}
          </div>
        )}
      </main>
      <footer className="site-footer page-width customer-footer">
        <Link to="/" className="footer-brand-home" aria-label="IYALVI home" replace>
          <Brand compact />
        </Link>
        <nav aria-label="Footer navigation">
          {customerNavigation.map((item) => (
            <CustomerNavLink key={item.to} to={item.to}>
              {item.label}
            </CustomerNavLink>
          ))}
        </nav>
        <small>© {new Date().getFullYear()} IYALVI</small>
      </footer>
      <ProductDialog
        product={selected}
        onClose={() => setSelected(null)}
        notify={setToast}
        onAdded={() => setTrunk("bag")}
      />
      <TrunkDialog
        mode={trunk}
        onClose={() => setTrunk(null)}
        onSelect={setSelected}
        onCheckout={() => {
          setTrunk(null);
          void navigate({ to: "/checkout" });
        }}
      />
      {toast && (
        <div className="silk-toast" role="status">
          <span>{toast}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X />
          </Button>
        </div>
      )}
    </div>
  );
}
