import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail, MessageCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brand } from "@/components/iyalvi/motifs";
import { CustomerNavLink } from "@/components/iyalvi/customer-nav-link";
import { api } from "@/lib/api";
import { customerNavigation } from "@/lib/customer-navigation";
import { useCustomerTheme } from "@/hooks/use-customer-theme";

export function ContactPage({ embedded = false }: { embedded?: boolean } = {}) {
  useCustomerTheme();
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

  const contactSection = (
    <section className="contact-layout page-width" id="contact">
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
          <MessageCircle /> Chat with us on WhatsApp <ArrowRight />
        </a>
      </div>
      <form className="contact-form" onSubmit={(event) => void submit(event)}>
        <span className="eyebrow">SEND A LITTLE NOTE</span>
        <h2>{sent ? "Thanks for reaching out." : "How can we help?"}</h2>
        {sent ? (
          <p className="contact-success" role="status">
            Thanks, {name}. Your note has been received.
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
      </form>
    </section>
  );

  if (embedded) return contactSection;

  return (
    <div className="iyalvi-app signature-page contact-page">
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
      <main>{contactSection}</main>
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
