import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { products, occasions, filterProducts, formatPrice, type Product } from "@/data/products";
import { usePrototype } from "@/data/store";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Kolam } from "./motifs";

export function ProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (p: Product) => void;
}) {
  const { wishlist, toggleWish } = usePrototype();
  const reduced = useReducedMotion();
  const [imageLoaded, setImageLoaded] = useState(false);
  const saved = wishlist.includes(product.id);
  const alternateColor =
    product.category === "Kurtis"
      ? products.find(
          (candidate) =>
            candidate.category === "Kurtis" &&
            candidate.id !== product.id &&
            candidate.name.split(" ")[0] === product.name.split(" ")[0],
        )
      : undefined;
  return (
    <article className={`product-card product-card-${product.category.toLowerCase()}`}>
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
          {alternateColor && (
            <img
              className="product-alternate-image"
              src={alternateColor.image}
              width={768}
              height={1024}
              alt={`${product.name} in ${alternateColor.colors[0]}`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          )}
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
          onClick={() => toggleWish(product.id)}
        >
          <motion.span
            animate={saved && !reduced ? { scale: [1, 1.4, 1], rotate: [0, 15, 0] } : { scale: 1 }}
          >
            <Heart fill={saved ? "currentColor" : "none"} />
          </motion.span>
        </Button>
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
      </div>
    </article>
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
  const results = filterProducts(query, category);
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
          {["All", ...occasions].map((o) => (
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
                <small>
                  {p.fabric} · {p.occasion}
                </small>
                <b>{formatPrice(p.price)}</b>
              </span>
              <ArrowUpRight />
            </Button>
          ))}
          {results.length === 0 && (
            <div className="empty-state">
              <Kolam />
              <h3>Your next favourite is out there.</h3>
              <p>Try another style, colour or occasion.</p>
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
}: {
  product: Product | null;
  onClose: () => void;
  notify: (v: string) => void;
}) {
  const { addToBag, toggleWish, wishlist, rememberProduct } = usePrototype();
  const [adding, setAdding] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (product) rememberProduct(product.id);
  }, [product, rememberProduct]);
  const add = () => {
    if (!product || adding) return;
    addToBag(product.id);
    setAdding(true);
    notify(`${product.name} is in your bag.`);
    setTimeout(() => setAdding(false), 900);
  };
  const look = product
    ? products
        .filter(
          (candidate) =>
            candidate.id !== product.id &&
            candidate.category !== product.category &&
            candidate.occasion === product.occasion,
        )
        .slice(0, 2)
    : [];
  return (
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
              <Button className="detail-add" size="lg" onClick={add} disabled={adding}>
                <ShoppingBag />
                {adding ? "Added to your bag" : "Add to bag"}
                <ArrowUpRight />
              </Button>
              <Button variant="link" className="detail-wish" onClick={() => toggleWish(product.id)}>
                <Heart fill={wishlist.includes(product.id) ? "currentColor" : "none"} />
                {wishlist.includes(product.id) ? "Saved to your favourites" : "Save to favourites"}
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
                      <Button variant="outline" size="sm" onClick={() => addToBag(item.id)}>
                        Add
                      </Button>
                    </div>
                  ))}
                </section>
              )}
              <p className="prototype-note">
                A preview of your next favourite. Orders aren’t placed in this preview.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  const { bag, wishlist, changeQuantity, removeFromBag } = usePrototype();
  const chosen = products.filter((p) => wishlist.includes(p.id));
  const bagProducts = bag.flatMap((item) => {
    const product = products.find((p) => p.id === item.id);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const total = bagProducts.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
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
            {bagProducts.map(({ product, quantity }) => (
              <article className="cart-line-item" key={product.id}>
                <img src={product.image} alt={product.name} width={76} height={98} />
                <div className="cart-line-info">
                  <span>{product.fabric}</span>
                  <h3>{product.name}</h3>
                  <strong>{formatPrice(product.price)}</strong>
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
            {bagProducts.length === 0 && (
              <div className="empty-state cart-empty-state">
                <Kolam />
                <h3>Your bag is waiting.</h3>
                <p>Your next favourite is just around the corner.</p>
              </div>
            )}
          </div>
          <div className="cart-drawer-footer">
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <p>Shipping and taxes are calculated at checkout.</p>
            <Button
              className="cart-checkout-button"
              size="lg"
              disabled={bagProducts.length === 0}
              onClick={onCheckout}
            >
              Checkout <ArrowUpRight />
            </Button>
            <small>Front-end preview · checkout is a demo flow.</small>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog
        open={mode === "wishlist"}
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
            {chosen.length === 0 && (
              <div className="empty-state">
                <Kolam />
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
    </>
  );
}
