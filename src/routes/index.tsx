import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Search,
  Heart,
  ShoppingBag,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Flower2,
  Home,
  Instagram,
  MoveDown,
  Check,
  Mail,
  Truck,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Brand, Kolam, Diya } from "@/components/iyalvi/motifs";
import { LoomLoader, KolamCursor, PleatReveal } from "@/components/iyalvi/effects";
import {
  ProductCard,
  SearchDialog,
  ProductDialog,
  TrunkDialog,
} from "@/components/iyalvi/discovery";
import { AccountControl } from "@/components/iyalvi/account-control";
import { useDragScroll } from "@/components/iyalvi/use-drag-scroll";
import { usePrototype, type Locale } from "@/data/store";
import translations from "@/data/translations.json";
import {
  featuredProducts,
  newArrivalProducts,
  products,
  occasions,
  type Product,
} from "@/data/products";
import { nextFestival, countdown } from "@/data/festivals";
import hero from "@/assets/iyalvi-hero.jpg";
import teal from "@/assets/teal-saree.jpg";
import gold from "@/assets/gold-saree.jpg";
import rose from "@/assets/rose-saree.jpg";

const heroImages = [hero, teal, rose];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IYALVI — Everyday style, effortlessly yours" },
      {
        name: "description",
        content:
          "Explore easy-to-wear Sarees and Kurtis for everyday plans, celebrations and everything in between.",
      },
      { property: "og:title", content: "IYALVI — Everyday style, effortlessly yours" },
      { property: "og:description", content: "From brunch to big days, find your kind of style." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const occasionDetails = [
  { name: "Wedding", label: "Your big day, your way", image: rose, tone: "rose", icon: "✧" },
  { name: "Pongal", label: "Start the season in colour", image: gold, tone: "gold", icon: "☀" },
  { name: "Diwali", label: "Bring on the sparkle", image: hero, tone: "maroon", icon: "✦" },
  { name: "Navratri", label: "Nine nights, endless looks", image: teal, tone: "teal", icon: "❋" },
  { name: "Office", label: "Workday, well dressed", image: teal, tone: "indigo", icon: "◇" },
  { name: "Sangeet", label: "Ready when the music starts", image: rose, tone: "rose", icon: "♪" },
  { name: "Pooja", label: "A little something special", image: gold, tone: "gold", icon: "✧" },
  { name: "Casual", label: "Your everyday favourite", image: teal, tone: "teal", icon: "❋" },
];
const crafts = [
  {
    name: "Kanchipuram",
    state: "TAMIL NADU",
    image: hero,
    text: "A bold classic, made for now.",
    body: "Known for its rich silk, contrasting borders and intricate zari, Kanchipuram brings colour and character to a look. A striking choice for celebrations and moments worth dressing up for.",
  },
  {
    name: "Banarasi",
    state: "UTTAR PRADESH",
    image: rose,
    text: "A little shine goes a long way.",
    body: "Banarasi silk is loved for its floral details and luminous brocade. Its mix of texture and shine makes getting dressed for a special occasion feel effortless.",
  },
  {
    name: "Chanderi",
    state: "MADHYA PRADESH",
    image: gold,
    text: "Light layers, lovely details.",
    body: "Airy silk-cotton, a soft sheen and delicate motifs give Chanderi its easy appeal. Lightweight and versatile, it brings a little something extra to everyday plans.",
  },
  {
    name: "Ikat",
    state: "TELANGANA",
    image: teal,
    text: "Prints with their own point of view.",
    body: "Ikat patterns begin with yarns that are dyed before weaving, creating their signature soft-edged geometry. The result is a graphic, colourful look that feels just as good dressed up or down.",
  },
];

function Index() {
  const navigate = useNavigate();
  const state = usePrototype();
  const t = translations[state.locale];
  const [search, setSearch] = useState(false);
  const [searchCategory, setSearchCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKey, setSearchKey] = useState(0);
  const [selected, setSelected] = useState<Product | null>(null);
  const [trunk, setTrunk] = useState<"bag" | "wishlist" | null>(null);
  const [menu, setMenu] = useState(false);
  const [megaMenu, setMegaMenu] = useState<"Sarees" | "Kurtis" | null>(null);
  const [compactHeader, setCompactHeader] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [story, setStory] = useState<(typeof crafts)[number] | "brand" | "help" | null>(null);
  const [toast, setToast] = useState("");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const occasionRef = useRef<HTMLDivElement>(null);
  const trendingRef = useRef<HTMLDivElement>(null);
  const trendingDrag = useDragScroll();
  const occasionDrag = useDragScroll();
  const favoritesDrag = useDragScroll();
  const arrivalDrag = useDragScroll();
  const viewedDrag = useDragScroll();
  const testimonialDrag = useDragScroll();
  const heroRef = useRef<HTMLElement>(null);
  const heroDragStart = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const parallax = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const bagCount = state.bag.reduce((sum, p) => sum + p.quantity, 0);
  const festival = now ? nextFestival(now) : null;
  const remaining = now && festival ? countdown(festival.date, now) : null;
  useEffect(() => {
    void usePrototype.persist.rehydrate();
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const onScroll = () => setCompactHeader(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(
      () => setHeroIndex((index) => (index + 1) % heroImages.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [reduced]);
  useEffect(() => {
    if (reduced || !trendingRef.current) return;
    const timer = window.setInterval(() => {
      const rail = trendingRef.current;
      if (!rail) return;
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
      rail.scrollBy({ left: atEnd ? -rail.scrollWidth : 260, behavior: "smooth" });
    }, 4200);
    return () => window.clearInterval(timer);
  }, [reduced]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dusk");
    document.documentElement.lang = state.locale;
  }, [state.theme, state.locale]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchCategory("All");
        setSearchQuery("");
        setSearchKey((v) => v + 1);
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const openCollection = (category = "All", query = "") => {
    setSearchCategory(category);
    setSearchQuery(query);
    setSearchKey((v) => v + 1);
    setSearch(true);
    setMenu(false);
  };
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
    setMenu(false);
  };
  return (
    <div className="iyalvi-app">
      <LoomLoader />
      <KolamCursor />
      <PleatReveal value={`${state.locale}-${state.theme}`} />
      <div className="announcement">
        <Kolam />
        <span>{t.announcement}</span>
        <Kolam />
        <span className="announcement-right">From brunch to big days.</span>
      </div>
      <header
        className={`site-header ${compactHeader ? "is-compact" : ""}`}
        onMouseLeave={() => setMegaMenu(null)}
      >
        <div className="header-main page-width">
          <div className="header-left">
            <Button
              className="mobile-menu"
              size="icon"
              variant="ghost"
              aria-label={menu ? "Close menu" : "Open menu"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </Button>
            <span className="header-origin">
              MADE FOR YOUR MOMENTS.
              <br />
              MADE TO FEEL LIKE YOU.
            </span>
          </div>
          <Button
            variant="ghost"
            className="brand-home"
            aria-label="IYALVI home"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <Brand />
          </Button>
          <div className="header-tools">
            <select
              aria-label="Language"
              value={state.locale}
              onChange={(e) => state.setLocale(e.target.value as Locale)}
            >
              <option value="en">EN</option>
              <option value="ta">தமிழ்</option>
              <option value="hi">हिन्दी</option>
            </select>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${state.theme === "day" ? "Dusk" : "Day"} theme`}
              title={state.theme === "day" ? "Dusk" : "Day"}
              onClick={() => state.setTheme(state.theme === "day" ? "dusk" : "day")}
            >
              <Diya className="diya" />
            </Button>
            <span className="tool-divider" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => openCollection()}
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
                <span className="icon-count">{state.wishlist.length}</span>
              )}
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
        </div>
        <nav className={`desktop-nav ${menu ? "menu-is-open" : ""}`} aria-label="Main navigation">
          <Link to="/new-arrivals">
            {t.new}
            <span className="new-dot" />
          </Link>
          {(["Sarees", "Kurtis"] as const).map((category) => (
            <div className="nav-mega" key={category} onMouseEnter={() => setMegaMenu(category)}>
              <Link
                to={category === "Sarees" ? "/sarees" : "/kurtis"}
                onFocus={() => setMegaMenu(category)}
              >
                {category}
                <ChevronDown />
              </Link>
              {megaMenu === category && (
                <div className="mega-menu">
                  <strong>Explore {category}</strong>
                  {(category === "Sarees"
                    ? ["Silk", "Cotton", "Designer", "Party Wear"]
                    : ["Daily Wear", "Office Wear", "Party Wear", "Co-ord Sets"]
                  ).map((label) => (
                    <Link
                      key={label}
                      to={category === "Sarees" ? "/sarees" : "/kurtis"}
                      onClick={() => setMegaMenu(null)}
                    >
                      {label}
                      <ArrowUpRight />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Button variant="link" onClick={() => scrollTo("occasions")}>
            {t.occasion}
            <ChevronDown />
          </Button>
          <Button variant="link" onClick={() => scrollTo("craft")}>
            {t.craft}
          </Button>
          <Link to="/offers">Offers</Link>
          <Link to="/about">Our Story</Link>
          <Link to="/contact">Contact</Link>
          <span className="nav-special">
            <Sparkles size={13} /> THE EVERYDAY EDIT
          </span>
        </nav>
      </header>
      <main>
        <section
          className="hero"
          ref={heroRef}
          onPointerDown={(event) => {
            heroDragStart.current = event.clientX;
          }}
          onPointerUp={(event) => {
            const dragStart = heroDragStart.current;
            if (dragStart !== null && Math.abs(event.clientX - dragStart) > 55) {
              setHeroIndex(
                (index) =>
                  (index + (event.clientX < dragStart ? 1 : heroImages.length - 1)) %
                  heroImages.length,
              );
            }
            heroDragStart.current = null;
          }}
        >
          <motion.img
            key={heroIndex}
            className="hero-photo"
            src={heroImages[heroIndex]}
            width={1792}
            height={1024}
            alt="IYALVI outfit inspiration"
            fetchPriority="high"
            initial={reduced ? false : { opacity: 0.75, scale: 1.025 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1 }}
            style={reduced ? {} : { y: parallax }}
          />
          <div className="hero-shade" />
          <div className="hero-arch" aria-hidden="true" />
          <div className="hero-content page-width">
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
            >
              <div className="hero-eyebrow">
                <span />
                {t.eyebrow}
              </div>
              <h1>
                <span>{t.hero1}</span>
                <em>{t.hero2}</em>
              </h1>
              <p>{t.description}</p>
              <div className="hero-actions">
                <Button className="hero-cta magnetic" size="lg" onClick={() => openCollection()}>
                  {t.explore}
                  <ArrowUpRight />
                </Button>
                <Button className="hero-story" variant="link" onClick={() => setStory("brand")}>
                  {t.discover}
                  <ArrowRight />
                </Button>
              </div>
              <div className="hero-footnote">
                <Kolam />
                <span>
                  LOOK GOOD. <b>FEEL LIKE YOU.</b>
                </span>
              </div>
            </motion.div>
          </div>
          <span className="hero-side">A LOOK FOR EVERY MOMENT</span>
          <div className="hero-bottom">
            <Button variant="ghost" onClick={() => scrollTo("occasions")} className="scroll-cue">
              <MoveDown />
              Find your next favourite
            </Button>
            <span className="hero-pagination">
              <b>0{heroIndex + 1}</b>
              <span />
              <small>03</small>
            </span>
            <span className="hero-caption">
              MADE FOR YOUR MOMENTS <ArrowUpRight size={14} />
            </span>
          </div>
        </section>
        <div className="heritage-ribbon">
          <span>STYLE THAT FEELS LIKE YOU</span>
          <Kolam />
          <span>MADE TO MOVE WITH YOU</span>
          <Kolam />
          <span>MADE FOR EVERY DAY</span>
          <Kolam />
          <span>MAKE IT YOUR MOMENT</span>
          <Kolam />
          <span>STYLE THAT FEELS LIKE YOU</span>
        </div>
        <section className="section page-width trending-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE LOOKS EVERYONE’S LOVING</span>
              <h2>Trending now</h2>
              <p>Style notes for right now, ready to make your own.</p>
            </div>
            <Link to="/new-arrivals" className="button-link">
              See what’s new <ArrowRight />
            </Link>
          </div>
          <div className="trending-rail" ref={trendingRef} {...trendingDrag}>
            {[...featuredProducts, ...newArrivalProducts].map((product) => (
              <div className="trending-card" key={product.id}>
                <ProductCard product={product} onSelect={setSelected} />
              </div>
            ))}
          </div>
        </section>
        <section id="occasions" className="section page-width occasion-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">GET DRESSED FOR YOUR DAY</span>
              <h2>{t.occasionTitle}</h2>
              <p>{t.occasionSub}</p>
            </div>
            <div className="carousel-arrows">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous occasions"
                onClick={() => occasionRef.current?.scrollBy({ left: -350, behavior: "smooth" })}
              >
                <ArrowLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next occasions"
                onClick={() => occasionRef.current?.scrollBy({ left: 350, behavior: "smooth" })}
              >
                <ArrowRight />
              </Button>
            </div>
          </div>
          <div className="occasion-carousel" ref={occasionRef} {...occasionDrag}>
            {occasionDetails.map((o, i) => (
              <Button
                key={o.name}
                variant="ghost"
                className={`occasion-card occasion-${o.tone}`}
                onClick={() => openCollection(o.name)}
                data-drape
              >
                <div className="occasion-image">
                  <img
                    src={o.image}
                    alt={`${o.name} outfit inspiration`}
                    width={768}
                    height={1024}
                    loading="lazy"
                  />
                  <span className="occasion-number">0{i + 1}</span>
                  <span className="occasion-motif">{o.icon}</span>
                </div>
                <div className="occasion-text">
                  <h3>
                    {o.name}
                    <ArrowUpRight />
                  </h3>
                  <p>{o.label}</p>
                </div>
              </Button>
            ))}
          </div>
        </section>
        <section className="festival-banner">
          <div className="festival-inner page-width">
            <Kolam className="festival-kolam" />
            <div>
              <span className="eyebrow">A LITTLE SOMETHING TO CELEBRATE</span>
              <h2>
                {festival ? `${festival.name} is in the air.` : "A celebration is on its way."}
              </h2>
              <p>Find the look for whatever is next.</p>
            </div>
            <div className="countdown">
              {(["days", "hours", "minutes"] as const).map((unit) => (
                <div key={unit}>
                  <strong>{remaining ? String(remaining[unit]).padStart(2, "0") : "—"}</strong>
                  <span>{unit}</span>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="festival-cta"
              onClick={() => openCollection(festival?.name ?? "All")}
            >
              Find your celebration look
              <ArrowUpRight />
            </Button>
          </div>
        </section>
        <section className="section page-width favorites-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE EVERYDAY EDIT</span>
              <h2>{t.pieces}</h2>
              <p>Meet the looks we can’t stop wearing.</p>
            </div>
            <Button variant="link" className="section-link" onClick={() => openCollection()}>
              Shop all styles
              <ArrowUpRight />
            </Button>
          </div>
          <div className="product-rail" {...favoritesDrag}>
            {featuredProducts.map((p) => (
              <div className="product-rail-item" key={p.id}>
                <ProductCard product={p} onSelect={setSelected} />
              </div>
            ))}
          </div>
        </section>
        <section className="new-arrivals-teaser">
          <div className="page-width new-arrivals-teaser-inner">
            <div>
              <span className="eyebrow">A FRESH LITTLE SOMETHING</span>
              <h2>Meet the new arrivals</h2>
              <p>Five fresh finds, with introductory prices through October 31, 2026.</p>
            </div>
            <Link to="/new-arrivals" className="button-link">
              Shop the new edit <ArrowRight />
            </Link>
          </div>
          <div className="page-width product-rail new-arrival-teaser-rail" {...arrivalDrag}>
            {newArrivalProducts.slice(0, 4).map((product) => (
              <div className="product-rail-item" key={product.id}>
                <ProductCard product={product} onSelect={setSelected} />
              </div>
            ))}
          </div>
        </section>
        {state.recentlyViewed.length > 0 && (
          <section className="section page-width recently-viewed-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                <h2>Recently viewed</h2>
                <p>Your saved-in-this-browser style trail.</p>
              </div>
            </div>
            <div className="product-rail" {...viewedDrag}>
              {state.recentlyViewed
                .map((id) => products.find((product) => product.id === id))
                .filter((product): product is Product => Boolean(product))
                .map((product) => (
                  <div className="product-rail-item" key={product.id}>
                    <ProductCard product={product} onSelect={setSelected} />
                  </div>
                ))}
            </div>
          </section>
        )}
        <section className="trust-strip page-width" aria-label="Shopping benefits">
          <div>
            <RefreshCw />
            <span>
              <strong>Easy returns</strong>
              <small>Change your mind with ease</small>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <strong>Secure payment</strong>
              <small>A smooth, safe checkout</small>
            </span>
          </div>
          <div>
            <Truck />
            <span>
              <strong>Fast delivery</strong>
              <small>Good things, on their way</small>
            </span>
          </div>
        </section>
        <div className="zari-divider">
          <span />
          <Kolam />
          <span />
        </div>
        <section id="craft" className="section page-width craft-section">
          <div className="craft-intro">
            <span className="eyebrow">GOOD DESIGN, THOUGHTFULLY MADE</span>
            <h2>{t.craftTitle}</h2>
            <p>
              Every detail has a reason. Every piece has a point of view.
              <br />
              Get to know the ideas behind your new favourites.
            </p>
          </div>
          <div className="craft-grid">
            {crafts.map((c, i) => (
              <Button
                variant="ghost"
                className={`craft-card craft-card-${i}`}
                key={c.name}
                onClick={() => setStory(c)}
              >
                <img
                  src={c.image}
                  alt={`${c.name} textile style`}
                  width={768}
                  height={1024}
                  loading="lazy"
                />
                <div className="craft-shade" />
                <span className="craft-no">0{i + 1} / THE STYLE JOURNAL</span>
                <div className="craft-card-text">
                  <span>{c.state}</span>
                  <h3>{c.name}</h3>
                  <p>{c.text}</p>
                  <span className="craft-read">
                    Get to know the style <ArrowUpRight />
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </section>
        <section className="community-section">
          <div className="page-width">
            <div className="section-heading">
              <div>
                <span className="eyebrow">YOUR MOMENTS. YOUR STYLE.</span>
                <h2>{t.community}</h2>
                <p>The best part of getting dressed? Making it yours.</p>
              </div>
              <span className="community-hashtag">
                <Instagram size={18} /> #MyIyalviStory
              </span>
            </div>
            <div className="community-grid">
              {[teal, rose, gold, hero].map((image, i) => (
                <Button
                  variant="ghost"
                  className="community-photo"
                  key={image}
                  onClick={() => {
                    setSelected(featuredProducts[i] ?? null);
                  }}
                  data-drape
                >
                  <img
                    src={image}
                    alt={`IYALVI styling inspiration ${i + 1}`}
                    width={768}
                    height={1024}
                    loading="lazy"
                  />
                  <span>
                    <Instagram size={17} /> @iyalvi.muse
                  </span>
                </Button>
              ))}
            </div>
            <p className="community-note">Style inspiration · your looks could be next.</p>
          </div>
        </section>
        <section className="testimonials section page-width">
          <Kolam />
          <span className="eyebrow">LOVE, IN YOUR WORDS</span>
          <div className="testimonial-rail" {...testimonialDrag}>
            <article>
              <blockquote>
                “It felt like me from the first wear. The colour, the comfort, the little details —
                just right.”
              </blockquote>
              <div className="review-stars">✦ ✦ ✦ ✦ ✦</div>
              <p>
                ANANYA R. <span>·</span> CHENNAI
              </p>
            </article>
            <article>
              <blockquote>
                “Easy to style, lovely to wear. It made an ordinary day feel a little brighter.”
              </blockquote>
              <div className="review-stars">✦ ✦ ✦ ✦ ✦</div>
              <p>
                MEERA S. <span>·</span> BENGALURU
              </p>
            </article>
            <article>
              <blockquote>
                “The fit, the print, the feel — exactly the kind of piece I keep reaching for.”
              </blockquote>
              <div className="review-stars">✦ ✦ ✦ ✦ ✦</div>
              <p>
                PRIYA K. <span>·</span> CHENNAI
              </p>
            </article>
          </div>
          <small>A little love note for our preview</small>
        </section>
        <section className="newsletter">
          <div className="page-width newsletter-inner">
            <div>
              <span className="eyebrow">LET?S STAY IN THE LOOP</span>
              <h2>{t.newsletter}</h2>
              <p>Fresh styles, outfit ideas and little joys. Only the good things.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                state.subscribe(email);
                setSubscribed(true);
                setToast("You are on the list. Expect a few good things in your inbox.");
              }}
            >
              <div className="newsletter-input">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSubscribed(false);
                  }}
                  placeholder={t.email}
                  aria-label="Newsletter email"
                />
                <Button type="submit" variant="ghost">
                  {subscribed ? (
                    <>
                      <Check />
                      You?re on the list
                    </>
                  ) : (
                    <>
                      {t.subscribe}
                      <ArrowRight />
                    </>
                  )}
                </Button>
              </div>
              <span>No noise. Just fresh finds and outfit inspiration. Saved on this device.</span>
            </form>
            <Kolam className="newsletter-motif" />
          </div>
        </section>
      </main>
      <footer className="site-footer page-width">
        <div className="footer-main">
          <div className="footer-brand">
            <Brand />
            <p>Everyday style, effortlessly yours.</p>
            <span>
              From everyday plans to big days.
              <br />
              Find a look that feels like you.
            </span>
          </div>
          <div>
            <h3>Discover</h3>
            <Link to="/new-arrivals">New Arrivals</Link>
            <Link to="/sarees">Sarees</Link>
            <Link to="/kurtis">Kurtis</Link>
            <Link to="/offers">Offers</Link>
            <Button variant="link" onClick={() => scrollTo("occasions")}>
              Occasion wear
            </Button>
          </div>
          <div>
            <h3>More from us</h3>
            <Link to="/about">Our story</Link>
            <Button variant="link" onClick={() => scrollTo("craft")}>
              Our design
            </Button>
            <Button variant="link" onClick={() => scrollTo("occasions")}>
              Occasion styles
            </Button>
            <Link to="/contact">Contact us</Link>
          </div>
          <div className="footer-contact">
            <h3>We’re here for you</h3>
            <Link to="/contact">
              <Mail />
              Let’s talk
            </Link>
            <p>
              Need a hand? We are here to help.
              <br />A little help goes a long way.
            </p>
            <Kolam />
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {now?.getFullYear() ?? 2026} IYALVI. All styles, made for your story.</span>
          <span>
            MADE FOR YOUR MOMENTS <Kolam /> READY WHEN YOU ARE
          </span>
          <span>Prototype · made with love</span>
        </div>
      </footer>
      <nav className="mobile-bottom" aria-label="Mobile navigation">
        <Button variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <Home />
          <span>Home</span>
        </Button>
        <Link to="/sarees" className="mobile-nav-link">
          <span className="mobile-nav-initial">S</span>
          <span>Sarees</span>
        </Link>
        <Link to="/kurtis" className="mobile-nav-link">
          <span className="mobile-nav-initial">K</span>
          <span>Kurtis</span>
        </Link>
        <Button variant="ghost" onClick={() => openCollection()}>
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
      <SearchDialog
        key={searchKey}
        open={search}
        onOpenChange={setSearch}
        onSelect={setSelected}
        initialCategory={searchCategory}
        initialQuery={searchQuery}
      />
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
      <Dialog
        open={Boolean(story)}
        onOpenChange={(v) => {
          if (!v) setStory(null);
        }}
      >
        <DialogContent className="story-dialog">
          <Kolam />
          {typeof story === "object" && story ? (
            <>
              <span className="eyebrow">{story.state} · THE STYLE JOURNAL</span>
              <DialogTitle className="font-display text-4xl">{story.name}</DialogTitle>
              <img src={story.image} alt={story.name} width={768} height={1024} />
              <DialogDescription>{story.body}</DialogDescription>
              <Button
                onClick={() => {
                  openCollection("All", story.name);
                  setStory(null);
                }}
              >
                Explore this style
                <ArrowUpRight />
              </Button>
            </>
          ) : (
            <>
              <DialogTitle className="font-display text-4xl">
                {story === "help" ? "A little care goes a long way." : "Your style. Your story."}
              </DialogTitle>
              <DialogDescription>
                {story === "help"
                  ? "Follow the care label to keep your favourite pieces looking their best. Store them clean and dry, away from direct sunlight. Customer support and ordering will arrive in a future chapter."
                  : "IYALVI is about feeling good in what you wear — from easy everyday favourites to looks for the moments that matter. Find your fit, make it your own, and wear it your way."}
              </DialogDescription>
              <p className="story-tagline">Everyday style, effortlessly yours.</p>
              <small>Brand details are illustrative for this preview.</small>
            </>
          )}
        </DialogContent>
      </Dialog>
      {toast && (
        <motion.div
          className="silk-toast"
          role="status"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Kolam />
          <span>{toast}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
