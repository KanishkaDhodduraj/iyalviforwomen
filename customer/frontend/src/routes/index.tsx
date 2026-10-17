import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Heart, Moon, Search, ShoppingBag, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/iyalvi/motifs";
import {
  ProductCard,
  ProductDialog,
  SearchDialog,
  TrunkDialog,
} from "@/components/iyalvi/discovery";
import { AccountControl } from "@/components/iyalvi/account-control";
import { ContactPage } from "@/components/iyalvi/contact-page";
import { CustomerNavLink } from "@/components/iyalvi/customer-nav-link";
import { TrendTalksPage } from "@/components/iyalvi/community-pages";
import { usePrototype } from "@/data/store";
import { formatPrice, type Product } from "@/data/products";
import { getAllProducts, productFromApi } from "@/lib/api";
import { customerNavigation } from "@/lib/customer-navigation";
import { useCustomerTheme } from "@/hooks/use-customer-theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IYALVI — Contemporary Indian wear" },
      { name: "description", content: "Discover sarees and kurtis from IYALVI." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const state = usePrototype();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [trunk, setTrunk] = useState<"bag" | "wishlist" | null>(null);
  const [toast, setToast] = useState("");
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [compactHeader, setCompactHeader] = useState(false);
  const reducedMotion = useReducedMotion();
  const bagCount = state.bag.reduce((sum, item) => sum + item.quantity, 0);
  useCustomerTheme();

  useEffect(() => {
    void usePrototype.persist.rehydrate();
  }, []);

  useEffect(() => {
    const updateHeader = () => setCompactHeader(window.scrollY > 40);
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (reducedMotion || typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      setHeadlineIndex((index) => (index + 1) % 3);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getAllProducts(new URLSearchParams({ sort: "newest" }))
      .then((result) => {
        if (active) setProducts(result.map(productFromApi));
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Products could not be loaded.");
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
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="iyalvi-app customer-home">
      <header className={`site-header customer-site-header ${compactHeader ? "is-compact" : ""}`}>
        <div className="header-main page-width">
          <Link to="/" className="brand-home" aria-label="IYALVI home" replace>
            <Brand compact />
          </Link>
          <div className="header-tools">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${state.theme === "day" ? "Dusk" : "Day"} theme`}
              onClick={() => state.setTheme(state.theme === "day" ? "dusk" : "day")}
            >
              {state.theme === "day" ? <Moon /> : <Sun />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Wishlist"
              onClick={() => setTrunk("wishlist")}
            >
              <Heart />
              {state.wishlist.length > 0 && (
                <span className="icon-count" key={state.wishlist.length}>
                  {state.wishlist.length}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Shopping bag, ${bagCount} items`}
              onClick={() => setTrunk("bag")}
            >
              <ShoppingBag />
              <span className="icon-count" key={bagCount}>
                {bagCount}
              </span>
            </Button>
            <AccountControl onWishlist={() => setTrunk("wishlist")} className="account-desktop" />
          </div>
        </div>
        <nav className="desktop-nav customer-primary-nav" aria-label="Main navigation">
          {customerNavigation.map((item) => (
            <CustomerNavLink key={item.to} to={item.to}>
              {item.label}
            </CustomerNavLink>
          ))}
        </nav>
      </header>

      <main>
        <section className="text-hero">
          <div className="text-hero-glow" aria-hidden="true" />
          <span className="hero-float hero-float-one" aria-hidden="true" />
          <span className="hero-float hero-float-two" aria-hidden="true" />
          <span className="hero-float hero-float-three" aria-hidden="true" />
          <div className="page-width text-hero-content">
            <span className="eyebrow">IYALVI · CONTEMPORARY INDIAN WEAR</span>
            <h1>
              <span className="text-hero-cycle" aria-live="polite">
                {["Drape it.", "Wear it.", "Own it."][headlineIndex]}
              </span>
            </h1>
            <p>Everyday elegance, made for the way you move through life.</p>
            <div className="hero-actions">
              <CustomerNavLink className="button-link" to="/sarees">
                Shop Sarees <ArrowRight />
              </CustomerNavLink>
              <CustomerNavLink className="button-link hero-secondary-link" to="/kurtis">
                Shop Kurtis <ArrowRight />
              </CustomerNavLink>
            </div>
          </div>
        </section>

        <section
          className="section page-width home-products-section"
          id="new-arrivals"
          aria-labelledby="home-products-heading"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">JUST ARRIVED</span>
              <h2 id="home-products-heading">Find your next favourite</h2>
            </div>
            <Link to="/new-arrivals" className="button-link">
              See all new arrivals <ArrowRight />
            </Link>
          </div>
          {loading && (
            <p className="empty-state" role="status">
              Loading the latest styles…
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
            <div className="home-product-grid">
              {products.slice(0, 8).map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                  whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.15) }}
                >
                  <ProductCard
                    product={product}
                    onSelect={setSelected}
                    onAdded={() => setTrunk("bag")}
                    notify={setToast}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        <section className="home-category-strip page-width" aria-label="Shop categories">
          <CustomerNavLink to="/sarees">
            <span className="eyebrow">THE SAREE EDIT</span>
            <strong>Find your saree</strong>
            <ArrowRight />
          </CustomerNavLink>
          <CustomerNavLink to="/kurtis">
            <span className="eyebrow">THE KURTI EDIT</span>
            <strong>Find your kurti</strong>
            <ArrowRight />
          </CustomerNavLink>
        </section>
        {(["Sarees", "Kurtis"] as const).map((category) => {
          const categoryProducts = products
            .filter((product) => product.category === category)
            .slice(0, 4);
          return (
            <section
              className="section page-width home-category-products"
              id={category.toLowerCase()}
              key={category}
              aria-labelledby={`home-${category.toLowerCase()}-heading`}
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {category === "Sarees" ? "THE SAREE EDIT" : "THE KURTI EDIT"}
                  </span>
                  <h2 id={`home-${category.toLowerCase()}-heading`}>{category}</h2>
                </div>
              </div>
              {loading && (
                <p className="empty-state" role="status">
                  Loading the latest styles…
                </p>
              )}
              {!loading && !error && categoryProducts.length === 0 && (
                <p className="empty-state">New styles are coming soon.</p>
              )}
              {categoryProducts.length > 0 && (
                <div className="home-product-grid">
                  {categoryProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                      whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.15 }}
                      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.15) }}
                    >
                      <ProductCard
                        product={product}
                        onSelect={setSelected}
                        onAdded={() => setTrunk("bag")}
                        notify={setToast}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        <TrendTalksPage embedded />
        <ContactPage embedded />
      </main>

      <footer className="site-footer page-width customer-footer">
        <Link to="/" className="footer-brand-home" aria-label="IYALVI home">
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

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} onSelect={setSelected} />
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
          {toast}
        </div>
      )}
    </div>
  );
}
