import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Heart, Home, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand, Kolam } from "@/components/iyalvi/motifs";
import {
  ProductCard,
  ProductDialog,
  SearchDialog,
  TrunkDialog,
} from "@/components/iyalvi/discovery";
import { kurtiProducts, sareeProducts, type Product, type ProductCategory } from "@/data/products";
import { usePrototype } from "@/data/store";
import { AccountControl } from "@/components/iyalvi/account-control";
import { motion, useReducedMotion } from "framer-motion";

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
  const [occasion, setOccasion] = useState("All");
  const [color, setColor] = useState("All");
  const [sizeIndex, setSizeIndex] = useState(1);
  const [compactHeader, setCompactHeader] = useState(false);
  const reduced = useReducedMotion();
  const items = category === "Sarees" ? sareeProducts : kurtiProducts;
  const visible = items.filter(
    (product) =>
      (subcategory === "All" || product.subcategory === subcategory) &&
      (fabric === "All" || product.fabric === fabric) &&
      (occasion === "All" || product.occasion === occasion) &&
      (color === "All" || product.colors.includes(color)),
  );
  const bagCount = state.bag.reduce((sum, item) => sum + item.quantity, 0);
  const categoryTitle =
    category === "Sarees" ? "Sarees for every kind of day" : "Kurtis for every kind of day";

  useEffect(() => {
    void usePrototype.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dusk");
  }, [state.theme]);

  useEffect(() => {
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
      <div className="announcement">
        <Kolam />
        <span>From brunch to big days.</span>
        <Kolam />
      </div>
      <header className={`site-header collection-header ${compactHeader ? "is-compact" : ""}`}>
        <div className="header-main page-width">
          <Link to="/" className="category-brand" aria-label="IYALVI home">
            <Brand />
          </Link>
          <nav className="collection-nav" aria-label="Main navigation">
            <Link to="/sarees" aria-current={category === "Sarees" ? "page" : undefined}>
              Sarees
            </Link>
            <Link to="/kurtis" aria-current={category === "Kurtis" ? "page" : undefined}>
              Kurtis
            </Link>
            <Link to="/new-arrivals">New Arrivals</Link>
            <Link to="/offers">Offers</Link>
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
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
              <span className="icon-count">{bagCount}</span>
            </Button>
            <AccountControl onWishlist={() => setTrunk("wishlist")} className="account-desktop" />
          </div>
        </div>
      </header>
      <main>
        <section className={`collection-hero collection-hero-${category.toLowerCase()}`}>
          <img src={items[0]?.image} alt="" aria-hidden="true" />
          <div className="collection-hero-shade" />
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
            <span className="collection-note">
              Made to be worn on repeat <Kolam />
            </span>
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
          {category === "Sarees" && (
            <div className="saree-filters" aria-label="Filter sarees">
              <label>
                Fabric{" "}
                <select value={fabric} onChange={(event) => setFabric(event.target.value)}>
                  <option>All</option>
                  {Array.from(new Set(items.map((item) => item.fabric))).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Occasion{" "}
                <select value={occasion} onChange={(event) => setOccasion(event.target.value)}>
                  <option>All</option>
                  {Array.from(new Set(items.map((item) => item.occasion))).map((value) => (
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
              {(fabric !== "All" || occasion !== "All" || color !== "All") && (
                <Button
                  variant="link"
                  onClick={() => {
                    setFabric("All");
                    setOccasion("All");
                    setColor("All");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
          <div className="product-grid">
            {visible.map((product, index) => (
              <motion.div
                key={product.id}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                whileInView={reduced ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ delay: Math.min(index * 0.025, 0.2) }}
              >
                <ProductCard product={product} onSelect={setSelected} />
              </motion.div>
            ))}
            {visible.length === 0 && (
              <p className="no-products">
                No styles match these filters yet. Try another combination.
              </p>
            )}
          </div>
        </section>
      </main>
      <footer className="collection-footer page-width">
        <Link to="/">IYALVI · Everyday style, effortlessly yours.</Link>
        <span className="collection-footer-links">
          <Link to="/new-arrivals">New Arrivals</Link>
          <Link to="/offers">Offers</Link>
          <Link to="/about">Our Story</Link>
          <Link to="/contact">Contact</Link>
        </span>
        <span>
          MADE FOR YOUR MOMENTS <Kolam /> READY WHEN YOU ARE
        </span>
      </footer>
      <nav className="mobile-bottom collection-bottom-nav" aria-label="Mobile navigation">
        <Link to="/" className="mobile-nav-link">
          <Home />
          <span>Home</span>
        </Link>
        <Link to="/sarees" className="mobile-nav-link">
          <span className="mobile-nav-initial">S</span>
          <span>Sarees</span>
        </Link>
        <Link to="/kurtis" className="mobile-nav-link">
          <span className="mobile-nav-initial">K</span>
          <span>Kurtis</span>
        </Link>
        <Button variant="ghost" onClick={() => setSearch(true)}>
          <Search />
          <span>Discover</span>
        </Button>
        <Button variant="ghost" onClick={() => setTrunk("wishlist")}>
          <Heart />
          <span>Loved</span>
        </Button>
        <Button variant="ghost" onClick={() => setTrunk("bag")}>
          <ShoppingBag />
          <span>Bag ({bagCount})</span>
        </Button>
        <AccountControl
          onWishlist={() => setTrunk("wishlist")}
          className="mobile-account-control"
        />
      </nav>
      <SearchDialog open={search} onOpenChange={setSearch} onSelect={setSelected} />
      <ProductDialog product={selected} onClose={() => setSelected(null)} notify={setToast} />
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
          <Kolam />
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
