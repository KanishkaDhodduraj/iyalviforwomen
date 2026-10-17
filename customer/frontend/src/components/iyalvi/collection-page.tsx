import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Heart, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/iyalvi/motifs";
import {
  ProductCard,
  ProductDialog,
  SearchDialog,
  TrunkDialog,
} from "@/components/iyalvi/discovery";
import { type Product, type ProductCategory } from "@/data/products";
import { usePrototype } from "@/data/store";
import { AccountControl } from "@/components/iyalvi/account-control";
import { CustomerNavLink } from "@/components/iyalvi/customer-nav-link";
import { motion, useReducedMotion } from "framer-motion";
import { getAllProducts, productFromApi } from "@/lib/api";
import { customerNavigation } from "@/lib/customer-navigation";

const subcategories: Record<ProductCategory, string[]> = {
  Sarees: ["Silk", "Cotton", "Designer", "Party Wear"],
  Kurtis: ["Daily Wear", "Office Wear", "Party Wear", "Co-ord Sets"],
};

export function CollectionPage({ category }: { category: ProductCategory }) {
  const navigate = useNavigate();
  const state = usePrototype();
  const [subcategory, setSubcategory] = useState("All");
  const [selected, setSelected] = useState<Product | null>(null);
  const [search, setSearch] = useState(false);
  const [trunk, setTrunk] = useState<"bag" | "wishlist" | null>(null);
  const [toast, setToast] = useState("");
  const [fabric, setFabric] = useState("All");
  const [color, setColor] = useState("All");
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");
  const [sizeIndex, setSizeIndex] = useState(1);
  const [compactHeader, setCompactHeader] = useState(false);
  const reduced = useReducedMotion();
  const items = products;
  const visible = items.filter(
    (product) =>
      (subcategory === "All" || product.subcategory === subcategory) &&
      (fabric === "All" || product.fabric === fabric) &&
      (color === "All" || product.colors.includes(color)),
  );
  const bagCount = state.bag.reduce((sum, item) => sum + item.quantity, 0);
  const categoryTitle =
    category === "Sarees" ? "Sarees for every kind of day" : "Kurtis for every kind of day";

  useEffect(() => {
    void usePrototype.persist.rehydrate();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setProducts([]);
    const query = new URLSearchParams({ sort });
    setLoadingProducts(true);
    setProductError("");
    void getAllProducts(query)
      .then((apiProducts) => {
        if (!controller.signal.aborted) {
          const requiredCategory = category === "Sarees" ? "Sarees" : "Kurtis";
          setProducts(
            apiProducts
              .map(productFromApi)
              .filter((product) => product.category === requiredCategory),
          );
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProductError(error instanceof Error ? error.message : "Products could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProducts(false);
      });
    return () => controller.abort();
  }, [category, sort]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", state.theme === "dusk");
  }, [state.theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateHeader = () => setCompactHeader(window.scrollY > 40);
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="iyalvi-app collection-page">
      <header className={`site-header collection-header ${compactHeader ? "is-compact" : ""}`}>
        <div className="header-main page-width">
          <Link to="/" className="category-brand" aria-label="IYALVI home" replace>
            <Brand compact />
          </Link>
          <nav className="collection-nav customer-primary-nav" aria-label="Main navigation">
            {customerNavigation.map((item) => (
              <CustomerNavLink
                key={item.to}
                to={item.to}
                ariaCurrent={
                  (item.to === "/sarees" && category === "Sarees") ||
                  (item.to === "/kurtis" && category === "Kurtis")
                    ? "page"
                    : undefined
                }
              >
                {item.label}
              </CustomerNavLink>
            ))}
          </nav>
          <div className="header-tools">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search products"
              onClick={() => setSearch(true)}
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
      </header>
      <main>
        <section className={`collection-hero collection-hero-${category.toLowerCase()}`}>
          <div className="collection-hero-content page-width">
            <Link to="/" className="collection-back">
              <ArrowRight /> Back to the home page
            </Link>
            <span className="eyebrow">
              {category === "Sarees" ? "YOUR SAREE, YOUR WAY" : "EASY STYLE, EVERY DAY"}
            </span>
            <h1>{categoryTitle}</h1>
            <p>
              {category === "Sarees"
                ? "From everyday plans to big moments, find a Saree that feels like you."
                : "Easy-to-wear favourites for workdays, celebrations and everything between."}
            </p>
          </div>
        </section>
        {category === "Kurtis" && (
          <section className="kurti-size-guide page-width" aria-label="Kurti size guide">
            <div>
              <span className="eyebrow">FIND YOUR FEEL-GOOD FIT</span>
              <h2>Size guide</h2>
              <p>Slide to preview a size. Each style includes a relaxed fit guide.</p>
            </div>
            <div className="size-guide-control">
              <input
                aria-label="Choose a kurti size"
                type="range"
                min="0"
                max="4"
                step="1"
                value={sizeIndex}
                onChange={(event) => setSizeIndex(Number(event.target.value))}
              />
              <div className="size-guide-labels">
                {["XS", "S", "M", "L", "XL"].map((size, index) => (
                  <button
                    type="button"
                    aria-pressed={sizeIndex === index}
                    key={size}
                    onClick={() => setSizeIndex(index)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <strong>
                {["XS", "S", "M", "L", "XL"][sizeIndex]} ·{" "}
                {["Extra small", "Small", "Medium", "Large", "Extra large"][sizeIndex]}
              </strong>
            </div>
          </section>
        )}
        <section className="section page-width collection-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND YOUR NEXT FAVOURITE</span>
              <h2>{subcategory === "All" ? `The ${category.toLowerCase()} edit` : subcategory}</h2>
              <p>{visible.length} pieces to discover</p>
            </div>
            <span className="collection-note">Made to be worn on repeat</span>
          </div>
          <div className="subcategory-filters" aria-label={`${category} subcategories`}>
            {["All", ...subcategories[category]].map((option) => (
              <Button
                key={option}
                variant={subcategory === option ? "default" : "outline"}
                aria-pressed={subcategory === option}
                onClick={() => setSubcategory(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <div className="saree-filters" aria-label={`Filter ${category.toLowerCase()}`}>
            <label>
              Fabric{" "}
              <select value={fabric} onChange={(event) => setFabric(event.target.value)}>
                <option>All</option>
                {Array.from(new Set(items.map((item) => item.fabric))).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Color</legend>
              <button
                className={`filter-color-swatch swatch-all ${color === "All" ? "is-selected" : ""}`}
                aria-label="All colors"
                aria-pressed={color === "All"}
                onClick={() => setColor("All")}
              >
                All
              </button>
              {Array.from(new Set(items.flatMap((item) => item.colors))).map((value) => (
                <button
                  key={value}
                  className={`filter-color-swatch color-${value.split(" ")[0]!.toLowerCase()} ${color === value ? "is-selected" : ""}`}
                  aria-label={value}
                  title={value}
                  aria-pressed={color === value}
                  onClick={() => setColor(value)}
                />
              ))}
            </fieldset>
            <label>
              Sort{" "}
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            {(subcategory !== "All" || fabric !== "All" || color !== "All") && (
              <Button
                variant="link"
                onClick={() => {
                  setSubcategory("All");
                  setFabric("All");
                  setColor("All");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <div className="product-grid">
            {loadingProducts &&
              Array.from({ length: 4 }, (_, index) => (
                <div
                  className="product-skeleton"
                  aria-label="Loading product"
                  key={`loading-${index}`}
                />
              ))}
            {productError && (
              <p className="form-error" role="alert">
                {productError}
              </p>
            )}
            {visible.map((product, index) => (
              <motion.div
                key={product.id}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                whileInView={reduced ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ delay: Math.min(index * 0.025, 0.2) }}
              >
                <ProductCard
                  product={product}
                  onSelect={setSelected}
                  onAdded={() => setTrunk("bag")}
                  notify={setToast}
                />
              </motion.div>
            ))}
            {!loadingProducts && !productError && items.length === 0 && (
              <p className="empty-state">New styles are coming soon.</p>
            )}
            {!loadingProducts && !productError && items.length > 0 && visible.length === 0 && (
              <p className="no-products">
                No styles match these filters yet. Try another combination.
              </p>
            )}
          </div>
        </section>
      </main>
      <footer className="collection-footer page-width">
        <Link to="/" aria-label="IYALVI home" replace>
          <Brand compact />
        </Link>
        <span className="collection-footer-links">
          {customerNavigation.map((item) => (
            <CustomerNavLink key={item.to} to={item.to}>
              {item.label}
            </CustomerNavLink>
          ))}
        </span>
      </footer>
      <SearchDialog open={search} onOpenChange={setSearch} onSelect={setSelected} />
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
            ×
          </Button>
        </div>
      )}
    </div>
  );
}
