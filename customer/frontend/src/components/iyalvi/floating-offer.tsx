import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePrototype } from "@/data/store";
import { api } from "@/lib/api";

const offer = {
  line: "A little something, just for you",
  details: "Sign in to receive a one-time offer created securely for your account.",
};

export function FloatingOffer() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const customer = usePrototype((state) => state.customer);

  useEffect(() => {
    setVisible(sessionStorage.getItem("iyalvi-offer-dismissed") !== "true");
  }, []);

  const shopOffer = () => {
    setOpen(false);
    void navigate({ to: "/offers" });
  };
  const revealCoupon = async () => {
    if (!customer) {
      setError("Sign in from your account to reveal a one-time offer.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { coupon: generated } = await api.post<{ coupon: { code: string } }>(
        "/offers/spin",
        {},
      );
      setCoupon(generated.code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your offer could not be generated.");
    } finally {
      setLoading(false);
    }
  };
  const copyCoupon = async () => {
    if (!coupon) return;
    try {
      await navigator.clipboard.writeText(coupon);
      setCopied(true);
      setError("");
    } catch {
      setCopied(false);
      setError("Copy isn’t available here. Select the code to copy it.");
    }
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.aside
            className="floating-offer"
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Button className="floating-offer-open" variant="ghost" onClick={() => setOpen(true)}>
              <Sparkles />
              <span>{offer.line}</span>
            </Button>
            <Button
              className="floating-offer-close"
              variant="ghost"
              size="icon"
              aria-label="Hide offers for this session"
              onClick={() => {
                sessionStorage.setItem("iyalvi-offer-dismissed", "true");
                setVisible(false);
              }}
            >
              <X />
            </Button>
          </motion.aside>
        )}
      </AnimatePresence>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="offer-dialog">
          <span className="eyebrow">A LITTLE EXTRA FOR YOU</span>
          <DialogTitle className="font-display text-4xl">{offer.line}</DialogTitle>
          <DialogDescription>{offer.details}</DialogDescription>
          <div className="offer-code">
            <div>
              <small>YOUR COUPON</small>
              <strong>{coupon || (loading ? "Creating your offer…" : "Reveal your offer")}</strong>
            </div>
            <Button variant="outline" onClick={() => void copyCoupon()} disabled={!coupon}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy code"}
            </Button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {coupon ? (
            <Button className="offer-shop-button" onClick={shopOffer}>
              Shop the offer
            </Button>
          ) : (
            <Button
              className="offer-shop-button"
              onClick={() => void revealCoupon()}
              disabled={loading}
            >
              {loading ? "Creating your offer…" : "Reveal my coupon"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
