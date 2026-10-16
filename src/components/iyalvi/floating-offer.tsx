import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePrototype } from "@/data/store";

const offers = [
  {
    line: "Flat 20% OFF on Kurtis",
    code: "EASY20",
    details: "Take 20% off selected Kurtis in the Everyday Edit.",
  },
  {
    line: "Free shipping above ₹999",
    code: "SHIPFREE",
    details: "Enjoy complimentary shipping on orders above ₹999.",
  },
];

export function FloatingOffer() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);
  const [offerIndex, setOfferIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const offer = offers[offerIndex]!;

  useEffect(() => {
    setVisible(sessionStorage.getItem("iyalvi-offer-dismissed") !== "true");
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(
      () => setOfferIndex((index) => (index + 1) % offers.length),
      5000,
    );
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const copyCode = async () => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError("Copy isn’t available here. Select the code to copy it.");
    }
  };

  const shopOffer = () => {
    setOpen(false);
    void navigate({ to: offerIndex === 0 ? "/kurtis" : "/new-arrivals" });
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
              <strong>{offer.code}</strong>
            </div>
            <Button variant="outline" onClick={() => void copyCode()}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy code"}
            </Button>
          </div>
          {copyError && (
            <p className="form-error" role="alert">
              {copyError}
            </p>
          )}
          <Button className="offer-shop-button" onClick={shopOffer}>
            Shop the offer
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
