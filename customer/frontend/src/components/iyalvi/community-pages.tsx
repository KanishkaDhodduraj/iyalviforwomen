import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/iyalvi/motifs";
import { CustomerNavLink } from "@/components/iyalvi/customer-nav-link";
import type { ApiReel } from "@/lib/api";
import { api } from "@/lib/api";
import { customerNavigation } from "@/lib/customer-navigation";
import { useCustomerTheme } from "@/hooks/use-customer-theme";

function CommunityFrame({
  children,
  embedded = false,
}: {
  children: ReactNode;
  embedded?: boolean;
}) {
  useCustomerTheme();
  if (embedded) {
    return (
      <section id="trend-talks" className="community-home-section">
        {children}
      </section>
    );
  }
  return (
    <div className="iyalvi-app community-page">
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
      <main className="community-page-content page-width">{children}</main>
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
    </div>
  );
}

export function TrendTalksPage({ embedded = false }: { embedded?: boolean }) {
  const [reels, setReels] = useState<ApiReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void api
      .get<{ reels: ApiReel[] }>("/reels")
      .then(({ reels: result }) => {
        if (active) setReels(result);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Trend Talks could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <CommunityFrame embedded={embedded}>
      <section className="community-page-heading">
        <span className="eyebrow">IYALVI TREND TALKS</span>
        <h1>See it in motion.</h1>
        <p>Style inspiration, shared by IYALVI.</p>
      </section>
      {loading && (
        <div className="community-reel-grid" role="status" aria-label="Loading Trend Talks">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="community-reel-skeleton" key={`reel-skeleton-${index}`} />
          ))}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && reels.length === 0 && (
        <p className="empty-state">There are no Trend Talks just yet. Check back soon.</p>
      )}
      {reels.length > 0 && (
        <div className="community-reel-grid">
          {reels.map((reel) => (
            <ReelCard reel={reel} key={reel._id} />
          ))}
        </div>
      )}
    </CommunityFrame>
  );
}

function ReelCard({ reel }: { reel: ApiReel }) {
  const cardRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const shortcode = /^[A-Za-z0-9_-]{1,20}$/.test(reel.shortcode) ? reel.shortcode : null;
  const [failed, setFailed] = useState(!shortcode);
  const [loading, setLoading] = useState(true);
  const active = Boolean(shortcode && inView && !failed);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active || !loading) return;
    const timeout = window.setTimeout(() => setFailed(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [active, loading]);

  return (
    <article className="community-reel-card" ref={cardRef}>
      <h2 className="community-reel-title">{reel.title}</h2>
      <div className="community-reel-embed">
        {active && shortcode && (
          <>
            {loading && <span className="community-reel-embed-skeleton" aria-hidden="true" />}
            <iframe
              src={`https://www.instagram.com/reel/${shortcode}/embed`}
              title={`Instagram: ${reel.title}`}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
              className={loading ? "is-loading" : ""}
            />
          </>
        )}
        {failed && (
          <div className="community-reel-fallback">
            <span className="eyebrow">IYALVI TREND TALKS</span>
            <strong>{reel.title}</strong>
          </div>
        )}
        {!active && !failed && (
          <div className="community-reel-placeholder" aria-hidden="true">
            <span className="eyebrow">IYALVI TREND TALKS</span>
            <strong>{reel.title}</strong>
          </div>
        )}
      </div>
      <a
        className="community-reel-open"
        href={reel.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        See on Instagram <ArrowRight />
      </a>
    </article>
  );
}
