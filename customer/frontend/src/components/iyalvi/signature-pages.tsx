import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  Gift,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  Sparkles,
  Search,
  Heart,
  ShoppingBag,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ProductCard,
  ProductDialog,
  SearchDialog,
  TrunkDialog,
} from "@/components/iyalvi/discovery";
import { Brand, Kolam } from "@/components/iyalvi/motifs";
import { formatPrice, type Product } from "@/data/products";
import { useDragScroll } from "@/components/iyalvi/use-drag-scroll";
import { AccountControl } from "@/components/iyalvi/account-control";
import { usePrototype } from "@/data/store";
import { api, productFromApi, type ApiProduct } from "@/lib/api";
import { z } from "zod";

const offerEnd = new Date("2026-10-31T23:59:59+05:30");

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function formatRemaining(target: Date, now: Date) {
  const total = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(total / 86_400_000);
  const hours = Math.floor((total % 86_400_000) / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  return `${String(days).padStart(2, "0")} : ${String(hours).padStart(2, "0")} : ${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(2, "0")}`;
}

function upcomingDrop(now: Date) {
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 20, 5, 30));
  if (target <= now) target.setUTCMonth(target.getUTCMonth() + 1);
  return target;
}

function SignatureHeader() {
  const navigate = useNavigate();
  const state = usePrototype();
  const [trunk, setTrunk] = useState<"bag" | "wishlist" | null>(null);
  const [search, setSearch] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const bagCount = state.bag.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    void usePrototype.persist.rehydrate();
  }, []);

  return (
    <>
      <div className="announcement">
        <Kolam />
        <span>From brunch to big days.</span>
        <Kolam />
      </div>
      <header className="site-header signature-header">
        <div className="header-main page-width">
          <Link to="/" className="category-brand" aria-label="IYALVI home">
            <Brand />
          </Link>
          <nav className="signature-nav" aria-label="Main navigation">
            <Link to="/new-arrivals">New Arrivals</Link>
            <Link to="/sarees">Sarees</Link>
            <Link to="/kurtis">Kurtis</Link>
            <Link to="/offers">Offers</Link>
          </nav>
          <div className="header-tools signature-tools">
            <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setSearch(true)}>
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
              className="bag-icon"
              aria-label={`Shopping bag, ${bagCount} items`}
              onClick={() => setTrunk("bag")}
            >
              <ShoppingBag />
              <span className="icon-count">{bagCount}</span>
            </Button>
            <AccountControl onWishlist={() => setTrunk("wishlist")} className="account-desktop" />
          </div>
          <Link to="/" className="signature-home-link">
            Back to home <ArrowUpRight />
          </Link>
        </div>
      </header>
      <nav className="mobile-bottom signature-bottom-nav" aria-label="Mobile navigation">
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
          {toast}
        </div>
      )}
    </>
  );
}

function SignatureFooter() {
  return (
    <footer className="signature-footer page-width">
      <Brand compact />
      <span>Made for your moments</span>
      <div>
        <Link to="/about">Our story</Link>
        <Link to="/contact">Contact</Link>
      </div>
    </footer>
  );
}

export function NewArrivalsPage() {
  const now = useClock();
  const reduced = useReducedMotion();
  const rail = useRef<HTMLDivElement>(null);
  const galleryDrag = useDragScroll();
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const [arrivals, setArrivals] = useState<Product[]>([]);
  const customer = usePrototype((state) => state.customer);
  const [arrivalsLoaded, setArrivalsLoaded] = useState(false);
  const [arrivalsError, setArrivalsError] = useState("");
  useEffect(() => {
    let active = true;
    setArrivals([]);
    setArrivalsLoaded(false);
    setArrivalsError("");
    void api
      .get<{ products: ApiProduct[] }>("/products?sort=newest&limit=20")
      .then(({ products: list }) => {
        if (active) {
          setArrivals(list.map(productFromApi).filter((product) => Boolean(product.originalPrice)));
          setArrivalsLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setArrivalsError(
            error instanceof Error ? error.message : "New arrivals could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [customer]);
  const visibleArrivals = arrivalsLoaded ? arrivals : [];
  const moveRail = (direction: number) =>
    rail.current?.scrollBy({
      left: direction * (rail.current.clientWidth * 0.75),
      behavior: reduced ? "instant" : "smooth",
    });
  return (
    <div className="iyalvi-app signature-page arrivals-page">
      <SignatureHeader />
      <main>
        <section className="arrivals-intro page-width">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 22 }}
            animate={reduced ? {} : { opacity: 1, y: 0 }}
          >
            <span className="eyebrow">JUST LANDED · THE NEW EDIT</span>
            <h1>
              Fresh finds, <em>made for you.</em>
            </h1>
            <p>
              Meet the latest sarees and kurtis, with a little welcome treat through October 31.
            </p>
            <div className="next-drop-clock">
              <Clock3 />
              <span>NEXT DROP IN</span>
              <strong>{now ? formatRemaining(upcomingDrop(now), now) : "-- : -- : -- : --"}</strong>
            </div>
          </motion.div>
          <div className="arrivals-orbit" aria-hidden="true">
            <Kolam />
            <span>
              NEW
              <br />
              SEASON
            </span>
          </div>
        </section>
        <section className="arrival-gallery-section">
          <div className="page-width section-heading">
            <div>
              <span className="eyebrow">LIMITED-TIME INTRO PRICES</span>
              <h2>Just dropped</h2>
              <p>Save up to 25% · Offer ends October 31, 2026</p>
            </div>
            <div className="carousel-arrows">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous new arrivals"
                onClick={() => moveRail(-1)}
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next new arrivals"
                onClick={() => moveRail(1)}
              >
                <ArrowRight />
              </Button>
            </div>
          </div>
          <div
            className="arrival-gallery"
            ref={rail}
            aria-label="New arrivals gallery"
            {...galleryDrag}
          >
            {arrivalsError && (
              <p className="form-error" role="alert">
                {arrivalsError}
              </p>
            )}
            {!arrivalsLoaded && !arrivalsError && <p role="status">Loading new arrivals…</p>}
            {visibleArrivals.map((product, index) => (
              <motion.article
                className="arrival-gallery-card"
                key={product.id}
                initial={reduced ? false : { opacity: 0, y: 18 }}
                whileInView={reduced ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.06 }}
              >
                <span className="new-shimmer-badge">
                  NEW ·{" "}
                  {product.originalPrice
                    ? Math.round((1 - product.price / product.originalPrice) * 100)
                    : 0}
                  % OFF
                </span>
                <ProductCard product={product} onSelect={setSelected} />
                <small>Offer valid through October 31, 2026</small>
              </motion.article>
            ))}
            {arrivalsLoaded && visibleArrivals.length === 0 && (
              <p className="empty-state">There are no discounted new arrivals right now.</p>
            )}
          </div>
        </section>
      </main>
      <SignatureFooter />
      <ProductDialog product={selected} onClose={() => setSelected(null)} notify={setToast} />
      {toast && (
        <div className="silk-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export function OffersPage() {
  const now = useClock();
  const reduced = useReducedMotion();
  const [turn, setTurn] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<{ code: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const customer = usePrototype((state) => state.customer);
  const [dealProducts, setDealProducts] = useState<Product[]>([]);
  const [dealProductsLoaded, setDealProductsLoaded] = useState(false);
  const [dealError, setDealError] = useState("");
  useEffect(() => {
    let active = true;
    setDealProducts([]);
    setDealProductsLoaded(false);
    setDealError("");
    void api
      .get<{ products: ApiProduct[] }>("/products?sort=newest&limit=20")
      .then(({ products: list }) => {
        if (active) {
          setDealProducts(
            list.map(productFromApi).filter((product) => Boolean(product.originalPrice)),
          );
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setDealError(cause instanceof Error ? cause.message : "Offers could not be loaded.");
      })
      .finally(() => {
        if (active) setDealProductsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [customer]);
  const spin = async () => {
    if (spinning || prize) return;
    if (!customer) {
      setError("Sign in from your account to spin the wheel.");
      return;
    }
    setSpinning(true);
    setError("");
    try {
      const { coupon } = await api.post<{
        coupon: { code: string; type: "percent" | "flat"; value: number };
      }>("/offers/spin", {});
      setPrize({
        code: coupon.code,
        label: coupon.type === "percent" ? `${coupon.value}% off` : `₹${coupon.value} off`,
      });
      setTurn((value) => value + 1440 + Math.floor(Math.random() * 360));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The offer could not be created.");
    } finally {
      window.setTimeout(() => setSpinning(false), reduced ? 0 : 2600);
    }
  };
  const copyCode = async () => {
    if (!prize) return;
    try {
      await navigator.clipboard.writeText(prize.code);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Copy isn’t available here. Select the code to copy it.");
    }
  };
  const bestDeal = dealProducts[0];
  return (
    <div className="iyalvi-app signature-page offers-page">
      <SignatureHeader />
      <main>
        <section className="offers-hero page-width">
          <span className="eyebrow">A LITTLE EXTRA FOR YOUR NEXT LOOK</span>
          <h1>
            Good looks. <em>Even better offers.</em>
          </h1>
          <p>Give the wheel a spin and find your little style surprise.</p>
        </section>
        <section className="offer-game page-width">
          <motion.div
            className="discount-wheel"
            animate={{ rotate: turn }}
            transition={{ duration: reduced ? 0 : 2.6, ease: [0.12, 0.8, 0.16, 1] }}
          >
            {["₹100", "₹250", "10%"].map((label, index) => (
              <span key={label} style={{ transform: `rotate(${index * 120 + 60}deg)` }}>
                <b>{label}</b>
              </span>
            ))}
            <div className="wheel-center">
              <Gift />
            </div>
          </motion.div>
          <div className="offer-game-copy">
            <span className="eyebrow">YOUR STYLE, YOUR LUCK</span>
            <h2>{prize ? "You’ve got a little something!" : "Spin to win a discount"}</h2>
            <p>
              {prize
                ? `Your one-time coupon ${prize.code} gives you ${prize.label}.`
                : "One spin, one coupon. Keep it for your next favourite."}
            </p>
            {prize ? (
              <div className="offer-prize-actions">
                <Button variant="outline" onClick={() => void copyCode()}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy code"}
                </Button>
                <Link to="/new-arrivals" className="button-link">
                  Shop the new edit <ArrowRight />
                </Link>
              </div>
            ) : (
              <Button onClick={spin} disabled={spinning} className="spin-button">
                {spinning ? "Your surprise is on its way…" : "Spin the wheel"} <Sparkles />
              </Button>
            )}
            {copyError && (
              <p className="form-error" role="alert">
                {copyError}
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>
        <section className="flash-sale page-width">
          <div>
            <span className="eyebrow">A LITTLE WHILE LEFT</span>
            <h2>Fresh arrivals, special prices</h2>
            <p>Introductory prices on the latest sarees and kurtis.</p>
            <Link to="/new-arrivals" className="button-link">
              Shop new arrivals <ArrowRight />
            </Link>
          </div>
          <div className="flash-countdown">
            <span>
              <Clock3 /> OFFER ENDS IN
            </span>
            <strong>{now ? formatRemaining(offerEnd, now) : "-- : -- : -- : --"}</strong>
            <small>Through October 31, 2026</small>
          </div>
        </section>
        <section className="flash-product page-width">
          {dealError && (
            <p className="form-error" role="alert">
              {dealError}
            </p>
          )}
          {bestDeal ? (
            <>
              <img src={bestDeal.image} alt={bestDeal.name} />
              <div>
                <span className="eyebrow">THIS WEEK’S LITTLE TREAT</span>
                <h2>{bestDeal.name}</h2>
                <p>
                  <strong>{formatPrice(bestDeal.price)}</strong>{" "}
                  {bestDeal.originalPrice && <del>{formatPrice(bestDeal.originalPrice)}</del>}
                </p>
                <Button variant="outline" onClick={() => setSelected(bestDeal)}>
                  Quick view <ArrowUpRight />
                </Button>
              </div>
            </>
          ) : !dealProductsLoaded ? (
            <p role="status">Loading offers…</p>
          ) : !dealError ? (
            <p className="empty-state">There are no discounted styles available right now.</p>
          ) : null}
        </section>
      </main>
      <SignatureFooter />
      <ProductDialog product={selected} onClose={() => setSelected(null)} notify={setToast} />
      {toast && (
        <div className="silk-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

const storyBeats = [
  {
    year: "THE IDEA",
    title: "Style that feels like you.",
    text: "A wardrobe should make getting dressed feel easy, expressive and entirely your own.",
  },
  {
    year: "THE EDIT",
    title: "Two ways to wear your day.",
    text: "Sarees for the moments you want to make, kurtis for all the plans in between.",
  },
  {
    year: "THE DETAILS",
    title: "Thoughtful, from first look to last.",
    text: "We bring colour, craft and comfort together in pieces you’ll reach for again.",
  },
  {
    year: "WHAT’S NEXT",
    title: "Your story keeps unfolding.",
    text: "New finds, fresh combinations and more room to make every look your own.",
  },
];

export function AboutPage() {
  const reduced = useReducedMotion();
  return (
    <div className="iyalvi-app signature-page about-page">
      <SignatureHeader />
      <main>
        <section className="about-hero">
          <div className="page-width">
            <span className="eyebrow">A NOTE FROM IYALVI</span>
            <h1>
              Wear what <em>feels like you.</em>
            </h1>
            <p>
              Good style should feel personal, joyful and ready for whatever your day has planned.
            </p>
            <Kolam />
          </div>
        </section>
        <section className="story-timeline page-width">
          <div className="timeline-intro">
            <span className="eyebrow">OUR STORY, IN A FEW MOMENTS</span>
            <h2>
              From first idea
              <br />
              to your everyday.
            </h2>
          </div>
          <div className="timeline-rail">
            {storyBeats.map((beat, index) => (
              <motion.article
                className={`timeline-beat timeline-beat-${index + 1}`}
                key={beat.year}
                initial={reduced ? false : { opacity: 0, x: index % 2 ? 32 : -32 }}
                whileInView={reduced ? {} : { opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.6 }}
              >
                <span className="timeline-marker">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{beat.year}</small>
                  <h3>{beat.title}</h3>
                  <p>{beat.text}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
        <section className="about-note page-width">
          <PackageCheck />
          <div>
            <span className="eyebrow">THE FEEL-GOOD CHECKLIST</span>
            <h2>Easy to wear. Easy to make your own.</h2>
            <p>Everyday comfort and occasion-ready details belong in the same wardrobe.</p>
          </div>
          <Link to="/sarees" className="button-link">
            Explore the edit <ArrowRight />
          </Link>
        </section>
      </main>
      <SignatureFooter />
    </div>
  );
}

export function ContactPage() {
  const reduced = useReducedMotion();
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(254),
        message: z.string().trim().min(10).max(3000),
      })
      .safeParse({ name, email, message });
    if (!parsed.success) {
      setError("Enter your name, a valid email and a message of at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/contact", parsed.data);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your note could not be sent.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="iyalvi-app signature-page contact-page">
      <SignatureHeader />
      <main>
        <section className="contact-layout page-width">
          <div className="contact-intro">
            <span className="eyebrow">HERE WHEN YOU NEED US</span>
            <h1>
              Let’s talk <em>style and everything else.</em>
            </h1>
            <p>Questions, ideas, or just a little help choosing? Send us a note.</p>
            <a
              className="whatsapp-link"
              href={`https://wa.me/?text=${encodeURIComponent("Hi IYALVI, I’d love some help with my order.")}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Chat with us on WhatsApp <ArrowUpRight />
            </a>
            <span className="contact-note">
              <MapPin /> A friendly note from our online studio
            </span>
          </div>
          <motion.form
            className="contact-form"
            onSubmit={(event) => void submit(event)}
            initial={reduced ? false : { opacity: 0, y: 18 }}
            whileInView={reduced ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="eyebrow">SEND A LITTLE NOTE</span>
            <h2>{sent ? "Thanks for reaching out." : "How can we help?"}</h2>
            {sent ? (
              <p className="contact-success" role="status">
                <Check /> Thanks, {name}. Your note has been received.
              </p>
            ) : (
              <>
                <label className="floating-field">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder=" "
                    required
                  />
                  <span>Your name</span>
                </label>
                <label className="floating-field">
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder=" "
                    required
                  />
                  <span>Email address</span>
                </label>
                <label className="floating-field floating-field-message">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder=" "
                    required
                  />
                  <span>Your message</span>
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Sending…" : "Send your note"} <Mail />
                </Button>
              </>
            )}
          </motion.form>
        </section>
      </main>
      <SignatureFooter />
    </div>
  );
}
