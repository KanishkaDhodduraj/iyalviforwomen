import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Heart,
  Search,
  Minus,
  Plus,
  ShoppingBag,
  Clock,
  Check,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatPrice, type Product } from "@/data/products";
import { usePrototype } from "@/data/store";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api, getAllProducts, productFromApi, type ApiProduct } from "@/lib/api";
import { LoginDialog } from "@/components/iyalvi/account-control";

export function ProductCard({
  product,
  onSelect,
  onAdded,
  notify,
}: {
  product: Product;
  onSelect: (p: Product) => void;
  onAdded?: () => void;
  notify?: (message: string) => void;
}) {
  const { wishlist, toggleWish } = usePrototype();
  const { addToBag } = usePrototype();
  const navigate = useNavigate();
  const customer = usePrototype((state) => state.customer);
  const wishlistError = usePrototype((state) => state.wishlistError);
  const reduced = useReducedMotion();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [checkoutAfterLogin, setCheckoutAfterLogin] = useState(false);
  const [wishlistAfterLogin, setWishlistAfterLogin] = useState(false);
  const [needsOptions, setNeedsOptions] = useState(false);
  const saved = wishlist.includes(product.id);
  const availability = size ? product.sizeStock?.[size] : undefined;
  const selectedInStock = availability?.inStock ?? product.inStock ?? true;
  const requiredChoices = [
    ...(product.sizes.length > 0 && !size ? ["size"] : []),
    ...(product.colors.length > 0 && !color ? ["colour"] : []),
  ];
  const add = (checkoutNow: boolean) => {
    if ((product.sizes.length > 0 && !size) || (product.colors.length > 0 && !color)) {
      setNeedsOptions(true);
      return;
    }
    if (!selectedInStock || product.inStock === false) return;
    setNeedsOptions(needsOptions && product.colors.length > 0 && !color);
    addToBag(
      product.id,
      size || product.sizes[0] || "One Size",
      color || product.colors[0] || "Default",
    );
    if (checkoutNow) {
      if (!customer) {
        setCheckoutAfterLogin(true);
        setLoginOpen(true);
      } else {
        void navigate({ to: "/checkout" });
      }
    } else {
      notify?.(`${product.name} was added to your bag.`);
      onAdded?.();
    }
  };
  return (
    <>
      <article
        id={`product-${product.slug}`}
        className={`product-card product-card-${product.category.toLowerCase()}`}
      >
        <div className="product-image-wrap">
          <Button
            variant="ghost"
            className={`product-image-button ${imageLoaded ? "image-is-loaded" : ""}`}
            onClick={() => onSelect(product)}
            aria-label={`Quick view ${product.name}`}
            data-drape
          >
            <span className="product-skeleton" aria-hidden="true" />
            <img
              className="product-primary-image"
              src={product.image}
              width={768}
              height={1024}
              alt={product.name}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
            <span className="product-interaction-label">
              {product.category === "Sarees" ? "Drape view · pallu & border" : "See another shade"}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`wish-button ${saved ? "is-saved" : ""}`}
            aria-label={`${saved ? "Remove" : "Save"} ${product.name}`}
            aria-pressed={saved}
            onClick={(event) => {
              event.stopPropagation();
              if (customer) toggleWish(product.id);
              else {
                setWishlistAfterLogin(true);
                setLoginOpen(true);
              }
            }}
          >
            <motion.span
              animate={
                saved && !reduced ? { scale: [1, 1.4, 1], rotate: [0, 15, 0] } : { scale: 1 }
              }
            >
              <Heart fill={saved ? "currentColor" : "none"} />
            </motion.span>
          </Button>
          {wishlistError && (
            <span className="form-error" role="alert">
              {wishlistError}
            </span>
          )}
          <span className="product-craft">
            {product.originalPrice ? (
              <b className="product-sale-badge">
                {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
              </b>
            ) : (
              product.craft
            )}
          </span>
        </div>
        <div className="product-meta">
          <span>{product.fabric}</span>
          <h3>
            <Button variant="link" onClick={() => onSelect(product)}>
              {product.name}
            </Button>
          </h3>
          <p className="product-price">
            {formatPrice(product.price)}
            {product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}
            <span
              className={`color-dot color-${(product.colors[0]?.split(" ")[0] ?? "heritage").toLowerCase()}`}
              aria-label={product.colors[0]}
            />
          </p>
          <div className="product-purchase-options">
            <label>
              <span className="sr-only">Size for {product.name}</span>
              <select
                aria-label={`Size for ${product.name}`}
                value={size}
                aria-invalid={needsOptions && product.sizes.length > 0 && !size}
                className={
                  needsOptions && product.sizes.length > 0 && !size ? "option-required" : ""
                }
                onChange={(event) => {
                  setSize(event.target.value);
                  setNeedsOptions(needsOptions && product.sizes.length > 0 && !size);
                }}
              >
                <option value="">Size</option>
                {product.sizes.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Colour for {product.name}</span>
              <select
                aria-label={`Colour for ${product.name}`}
                value={color}
                aria-invalid={needsOptions && product.colors.length > 0 && !color}
                className={
                  needsOptions && product.colors.length > 0 && !color ? "option-required" : ""
                }
                onChange={(event) => {
                  setColor(event.target.value);
                  setNeedsOptions(false);
                }}
              >
                <option value="">Colour</option>
                {product.colors.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          {size && availability?.lowStock !== null && availability?.lowStock !== undefined && (
            <p className="stock-urgency">Only {availability.lowStock} left</p>
          )}
          {size && !selectedInStock && <p className="stock-unavailable">Out of stock</p>}
          {!product.inStock && !size && <p className="stock-unavailable">Out of stock</p>}
          {needsOptions && (
            <p className="form-error product-option-error" role="alert">
              Choose {requiredChoices.join(" and ")} first.
            </p>
          )}
          <div className="product-card-actions">
            <Button
              type="button"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                add(false);
              }}
              disabled={!selectedInStock || product.inStock === false}
            >
              Add to bag
            </Button>
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                add(true);
              }}
              disabled={!selectedInStock || product.inStock === false}
            >
              Checkout now
            </Button>
          </div>
        </div>
      </article>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => {
          if (checkoutAfterLogin) void navigate({ to: "/checkout" });
          if (wishlistAfterLogin) toggleWish(product.id);
          setCheckoutAfterLogin(false);
          setWishlistAfterLogin(false);
        }}
      />
    </>
  );
}

export function SearchDialog({
  open,
  onOpenChange,
  onSelect,
  initialCategory = "All",
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (p: Product) => void;
  initialCategory?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const { recent, rememberSearch } = usePrototype();
  const [results, setResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError("");
      const params = new URLSearchParams({ limit: "20", sort: "newest" });
      if (query.trim()) params.set("search", query.trim());
      setSearchLoading(true);
      setSearchError("");
      void api
        .get<{ products: ApiProduct[] }>(`/products?${params.toString()}`)
        .then(({ products: list }) => {
          if (active) {
            const mapped = list.map(productFromApi);
            setResults(
              mapped.filter((product) => category === "All" || product.category === category),
            );
          }
        })
        .catch((error: unknown) => {
          if (active)
            setSearchError(error instanceof Error ? error.message : "Search is unavailable.");
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, category]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="search-dialog">
        <DialogTitle className="font-display text-3xl">Find your next favourite</DialogTitle>
        <DialogDescription>A colour, a style, a moment.</DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            rememberSearch(query);
          }}
          className="search-input-row"
        >
          <Search />
          <Input
            autoFocus
            aria-label="Search products"
            placeholder="Try ‘cotton’, ‘teal’ or ‘office’…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <div className="search-chips">
          {["All", "Sarees", "Kurtis"].map((o) => (
            <Button
              variant={category === o ? "default" : "outline"}
              key={o}
              onClick={() => setCategory(o)}
              aria-pressed={category === o}
            >
              {o}
            </Button>
          ))}
        </div>
        {!query && recent.length > 0 && (
          <div className="recent-searches">
            <Clock size={14} />
            <span>Recent searches</span>
            {recent.map((term) => (
              <Button variant="link" key={term} onClick={() => setQuery(term)}>
                {term}
              </Button>
            ))}
          </div>
        )}
        <div className="search-result-heading">
          <span>{results.length} pieces to discover</span>
          <span>Made to be worn on repeat</span>
        </div>
        <div className="search-results">
          {searchLoading && <p role="status">Finding pieces for you…</p>}
          {searchError && (
            <p className="form-error" role="alert">
              {searchError}
            </p>
          )}
          {results.map((p) => (
            <Button
              variant="ghost"
              className="search-result"
              key={p.id}
              onClick={() => {
                rememberSearch(query || p.craft);
                onOpenChange(false);
                onSelect(p);
              }}
            >
              <img src={p.image} alt={p.name} width={64} height={80} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.fabric}</small>
                <b>{formatPrice(p.price)}</b>
              </span>
              <ArrowUpRight />
            </Button>
          ))}
          {!searchLoading && !searchError && results.length === 0 && (
            <div className="empty-state">
              <h3>Your next favourite is out there.</h3>
              <p>Try another style, colour or search.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
              >
                See all styles
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProductDialog({
  product,
  onClose,
  notify,
  onAdded,
}: {
  product: Product | null;
  onClose: () => void;
  notify: (v: string) => void;
  onAdded?: () => void;
}) {
  const navigate = useNavigate();
  const { addToBag, toggleWish, wishlist, rememberProduct } = usePrototype();
  const customer = usePrototype((state) => state.customer);
  const [loginOpen, setLoginOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [checkoutAfterLogin, setCheckoutAfterLogin] = useState(false);
  const [wishlistAfterLogin, setWishlistAfterLogin] = useState(false);
  const [needsOptions, setNeedsOptions] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [relatedError, setRelatedError] = useState("");
  const reduced = useReducedMotion();
  useEffect(() => {
    if (product) {
      rememberProduct(product.id);
      setSize("");
      setColor("");
      setRelatedError("");
      setCatalog([]);
      void api
        .get<{ products: ApiProduct[] }>("/products?limit=50")
        .then(({ products: found }) => setCatalog(found.map(productFromApi)))
        .catch((error: unknown) => {
          setRelatedError(
            error instanceof Error ? error.message : "Related styles could not be loaded.",
          );
        });
    }
  }, [product, rememberProduct]);
  const purchase = (checkoutNow: boolean) => {
    if (!product || adding) return;
    if ((product.sizes.length > 0 && !size) || (product.colors.length > 0 && !color)) {
      setNeedsOptions(true);
      return;
    }
    if (!selectedInStock || product.inStock === false) return;
    setNeedsOptions(false);
    addToBag(
      product.id,
      size || product.sizes[0] || "One Size",
      color || product.colors[0] || "Default",
    );
    if (checkoutNow) {
      if (!customer) {
        setCheckoutAfterLogin(true);
        setLoginOpen(true);
      } else {
        setAdding(true);
        notify(`${product.name} is ready for checkout.`);
        void navigate({ to: "/checkout" });
      }
    } else {
      notify(`${product.name} was added to your bag.`);
      onAdded?.();
      onClose();
    }
  };
  const look = product
    ? catalog
        .filter(
          (candidate) => candidate.id !== product.id && candidate.category !== product.category,
        )
        .slice(0, 2)
    : [];
  const availability = product && size ? product.sizeStock?.[size] : undefined;
  const selectedInStock = availability?.inStock ?? product?.inStock ?? true;
  const requiredChoices = product
    ? [
        ...(product.sizes.length > 0 && !size ? ["size"] : []),
        ...(product.colors.length > 0 && !color ? ["colour"] : []),
      ]
    : [];
  return (
    <>
      <Dialog
        open={Boolean(product)}
        onOpenChange={(v) => {
          if (!v) onClose();
        }}
      >
        <DialogContent className="product-dialog">
          {product && (
            <>
              <div className="detail-image">
                <motion.img
                  src={product.image}
                  alt={product.name}
                  width={768}
                  height={1024}
                  animate={
                    adding && !reduced
                      ? { scale: [1, 0.65, 0.85, 1], rotateY: [0, 65, 0] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.7 }}
                />
                <AnimatePresence>
                  {adding && (
                    <motion.span
                      className="parcel-spark"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, y: -30 }}
                      exit={{ opacity: 0 }}
                    >
                      <ShoppingBag />
                      <Check />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="detail-content">
                <span className="eyebrow">{product.craft} · THE EVERYDAY EDIT</span>
                <DialogTitle className="font-display text-4xl">{product.name}</DialogTitle>
                <DialogDescription>
                  Easy-to-wear style for everyday plans and big moments.
                </DialogDescription>
                <p className="detail-price">
                  {formatPrice(product.price)}{" "}
                  {product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}
                </p>
                {product.originalPrice && (
                  <b className="product-sale-badge detail-sale-badge">
                    {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
                  </b>
                )}
                {size &&
                  availability?.lowStock !== null &&
                  availability?.lowStock !== undefined && (
                    <p className="stock-urgency">Only {availability.lowStock} left</p>
                  )}
                {size && !selectedInStock && <p className="stock-unavailable">Out of stock</p>}
                {!product.inStock && !size && <p className="stock-unavailable">Out of stock</p>}
                <div className="detail-options">
                  <label>
                    Colour
                    <select
                      value={color}
                      aria-invalid={needsOptions && product.colors.length > 0 && !color}
                      className={
                        needsOptions && product.colors.length > 0 && !color ? "option-required" : ""
                      }
                      onChange={(event) => {
                        setColor(event.target.value);
                        setNeedsOptions(needsOptions && product.sizes.length > 0 && !size);
                      }}
                    >
                      <option value="">Choose a colour</option>
                      {product.colors.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Size
                    <select
                      value={size}
                      aria-invalid={needsOptions && product.sizes.length > 0 && !size}
                      className={
                        needsOptions && product.sizes.length > 0 && !size ? "option-required" : ""
                      }
                      onChange={(event) => {
                        setSize(event.target.value);
                        setNeedsOptions(needsOptions && product.colors.length > 0 && !color);
                      }}
                    >
                      <option value="">Choose a size</option>
                      {product.sizes.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <dl>
                  <div>
                    <dt>Fabric</dt>
                    <dd>{product.fabric}</dd>
                  </div>
                  <div>
                    <dt>Made in</dt>
                    <dd>{product.craftOrigin}</dd>
                  </div>
                  <div>
                    <dt>Colour</dt>
                    <dd>{product.colors.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>
                      {product.sizes.join(", ")} ·{" "}
                      {product.category === "Sarees"
                        ? "5.5 m saree + blouse piece"
                        : "Ready-to-wear kurti"}
                    </dd>
                  </div>
                  <div>
                    <dt>Care</dt>
                    <dd>Check the care label for best results.</dd>
                  </div>
                </dl>
                {needsOptions && (
                  <p className="form-error product-option-error" role="alert">
                    Choose {requiredChoices.join(" and ")} first.
                  </p>
                )}
                <div className="detail-purchase-actions">
                  <Button
                    className="detail-add"
                    variant="outline"
                    onClick={() => purchase(false)}
                    disabled={adding || !selectedInStock || product.inStock === false}
                  >
                    <ShoppingBag />
                    Add to bag
                  </Button>
                  <Button
                    className="detail-add"
                    size="lg"
                    onClick={() => purchase(true)}
                    disabled={adding || !selectedInStock || product.inStock === false}
                  >
                    <ShoppingBag />
                    Checkout now
                    <ArrowUpRight />
                  </Button>
                </div>
                <Button
                  variant="link"
                  className="detail-wish"
                  onClick={() => {
                    if (customer) toggleWish(product.id);
                    else {
                      setWishlistAfterLogin(true);
                      setLoginOpen(true);
                    }
                  }}
                >
                  <Heart fill={wishlist.includes(product.id) ? "currentColor" : "none"} />
                  {wishlist.includes(product.id)
                    ? "Saved to your favourites"
                    : "Save to favourites"}
                </Button>
                {look.length > 0 && (
                  <section className="complete-look">
                    <span className="eyebrow">COMPLETE THE LOOK</span>
                    {look.map((item) => (
                      <div className="complete-look-item" key={item.id}>
                        <img src={item.image} alt="" />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{formatPrice(item.price)}</small>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            addToBag(
                              item.id,
                              item.sizes[0] ?? "One Size",
                              item.colors[0] ?? "Default",
                            );
                            notify(`${item.name} was added to your bag.`);
                            onAdded?.();
                            onClose();
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </section>
                )}
                {relatedError && (
                  <p className="form-error" role="alert">
                    {relatedError}
                  </p>
                )}
                <p className="prototype-note">
                  Stock and final pricing are confirmed by the server at checkout.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => {
          if (checkoutAfterLogin) void navigate({ to: "/checkout" });
          if (wishlistAfterLogin && product) toggleWish(product.id);
          setCheckoutAfterLogin(false);
          setWishlistAfterLogin(false);
        }}
      />
    </>
  );
}

export function TrunkDialog({
  mode,
  onClose,
  onSelect,
  onCheckout,
}: {
  mode: "bag" | "wishlist" | null;
  onClose: () => void;
  onSelect: (p: Product) => void;
  onCheckout: () => void;
}) {
  const { bag, wishlist, changeQuantity, removeFromBag, updateBagOptions } = usePrototype();
  const customer = usePrototype((state) => state.customer);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [quote, setQuote] = useState<{
    items: Array<{ product: string; unitPrice: number }>;
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
  } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    if (mode === "wishlist" && !customer) setLoginOpen(true);
  }, [mode, customer]);
  const chosen = catalog.filter((product) => wishlist.includes(product.id));
  const bagProducts = useMemo(
    () =>
      bag.flatMap((item) => {
        const product = catalog.find((candidate) => candidate.id === item.id);
        return product
          ? [
              {
                product,
                quantity: item.quantity,
                size: item.size ?? product.sizes[0] ?? "",
                color: item.color ?? product.colors[0] ?? "",
              },
            ]
          : [];
      }),
    [bag, catalog],
  );
  const pricingItems = useMemo(
    () =>
      bagProducts.map(({ product, quantity, size, color }) => ({
        productId: product.id,
        size,
        color,
        qty: quantity,
      })),
    [bagProducts],
  );
  useEffect(() => {
    if (mode === null || catalogLoaded) return;
    let active = true;
    setCatalogLoading(true);
    setQuoteError("");
    setCatalog([]);
    void getAllProducts()
      .then((apiProducts) => {
        if (active) setCatalog(apiProducts.map(productFromApi));
      })
      .catch((error: unknown) => {
        if (active)
          setQuoteError(
            error instanceof Error ? error.message : "Cart products could not be loaded.",
          );
      })
      .finally(() => {
        if (active) {
          setCatalogLoading(false);
          setCatalogLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [mode, catalogLoaded]);
  useEffect(() => {
    if (mode !== "bag" || bag.length === 0 || pricingItems.length !== bag.length) {
      setQuote(null);
      return;
    }
    let active = true;
    setLoadingQuote(true);
    setQuote(null);
    setQuoteError("");
    void api
      .post<{
        items: Array<{ product: string; unitPrice: number }>;
        subtotal: number;
        discount: number;
        shipping: number;
        total: number;
      }>("/cart/price", {
        items: pricingItems,
      })
      .then((result) => {
        if (active) setQuote(result);
      })
      .catch((error: unknown) => {
        if (active)
          setQuoteError(error instanceof Error ? error.message : "Cart pricing is unavailable.");
      })
      .finally(() => {
        if (active) setLoadingQuote(false);
      });
    return () => {
      active = false;
    };
  }, [mode, bag, pricingItems]);
  const total = quote?.total ?? 0;
  return (
    <>
      <Sheet
        open={mode === "bag"}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent side="right" className="cart-drawer">
          <SheetHeader className="cart-drawer-header">
            <span className="eyebrow">YOUR EDIT</span>
            <SheetTitle className="font-display text-4xl">
              Your bag <span>({bag.reduce((sum, item) => sum + item.quantity, 0)})</span>
            </SheetTitle>
            <SheetDescription>A few good picks, ready for whatever is next.</SheetDescription>
          </SheetHeader>
          <div className="cart-drawer-items">
            {bagProducts.map(({ product, quantity, size, color }) => (
              <article className="cart-line-item" key={product.id}>
                <img src={product.image} alt={product.name} width={76} height={98} />
                <div className="cart-line-info">
                  <span>{product.fabric}</span>
                  <h3>{product.name}</h3>
                  <strong>
                    {quote
                      ? formatPrice(
                          quote.items.find((item) => item.product === product.id)?.unitPrice ?? 0,
                        )
                      : "Price confirmed at checkout"}
                  </strong>
                  <label>
                    Colour
                    <select
                      value={color}
                      onChange={(event) => updateBagOptions(product.id, size, event.target.value)}
                    >
                      {product.colors.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Size
                    <select
                      value={size}
                      onChange={(event) => updateBagOptions(product.id, event.target.value, color)}
                    >
                      {product.sizes.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <div className="cart-line-actions">
                    <div className="quantity">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Decrease ${product.name} quantity`}
                        onClick={() => changeQuantity(product.id, -1)}
                      >
                        <Minus />
                      </Button>
                      <span>{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Increase ${product.name} quantity`}
                        disabled={quantity >= 10}
                        onClick={() => changeQuantity(product.id, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <Button
                      className="cart-remove"
                      variant="ghost"
                      onClick={() => removeFromBag(product.id)}
                    >
                      <Trash2 />
                      Remove
                    </Button>
                  </div>
                </div>
              </article>
            ))}
            {catalogLoading && bag.length > 0 && <p role="status">Loading cart products…</p>}
            {bag.length > 0 && bagProducts.length === 0 && !catalogLoading && (
              <p className="form-error" role="alert">
                {quoteError || "One or more saved cart items are no longer available."}
              </p>
            )}
            {bag.length === 0 && (
              <div className="empty-state cart-empty-state">
                <h3>Your bag is waiting.</h3>
                <p>Your next favourite is just around the corner.</p>
              </div>
            )}
          </div>
          <div className="cart-drawer-footer">
            {quoteError && (
              <p className="form-error" role="alert">
                {quoteError}
              </p>
            )}
            {loadingQuote && <p role="status">Checking price and availability…</p>}
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <strong>{quote ? formatPrice(quote.subtotal) : "—"}</strong>
            </div>
            <div className="cart-subtotal">
              <span>Discount</span>
              <strong>{quote ? `−${formatPrice(quote.discount)}` : "—"}</strong>
            </div>
            <div className="cart-subtotal">
              <span>Shipping</span>
              <strong>
                {quote ? (quote.shipping === 0 ? "Free" : formatPrice(quote.shipping)) : "—"}
              </strong>
            </div>
            <div className="cart-subtotal">
              <span>Total</span>
              <strong>{quote ? formatPrice(total) : "—"}</strong>
            </div>
            <p>Price and shipping are confirmed by the server.</p>
            <Button
              type="button"
              className="cart-checkout-button"
              size="lg"
              disabled={bag.length === 0 || bagProducts.length === 0 || catalogLoading}
              onClick={onCheckout}
            >
              Checkout <ArrowUpRight />
            </Button>
            {!customer && <small>Sign in at checkout to place your order.</small>}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog
        open={mode === "wishlist" && Boolean(customer)}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="trunk-dialog">
          <DialogTitle className="font-display text-4xl">Your favourites</DialogTitle>
          <DialogDescription>The styles you keep coming back to.</DialogDescription>
          <div className="trunk-items">
            {chosen.map((product) => (
              <div className="trunk-item" key={product.id}>
                <img src={product.image} alt={product.name} width={70} height={90} />
                <div>
                  <Button
                    variant="link"
                    onClick={() => {
                      onClose();
                      onSelect(product);
                    }}
                  >
                    {product.name}
                  </Button>
                  <p>{formatPrice(product.price)}</p>
                </div>
              </div>
            ))}
            {catalogLoading && wishlist.length > 0 && <p role="status">Loading favourites…</p>}
            {quoteError && (
              <p className="form-error" role="alert">
                {quoteError}
              </p>
            )}
            {!catalogLoading && wishlist.length > 0 && chosen.length === 0 && (
              <p role="status">Some saved styles may no longer be available.</p>
            )}
            {chosen.length === 0 && wishlist.length === 0 && (
              <div className="empty-state">
                <h3>Save a few favourites for later.</h3>
                <p>Your next favourite is just around the corner.</p>
                <Button variant="outline" onClick={onClose}>
                  Keep exploring <ArrowUpRight />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <LoginDialog
        open={loginOpen}
        onOpenChange={(open) => {
          setLoginOpen(open);
          if (!open && !customer) onClose();
        }}
      />
    </>
  );
}
