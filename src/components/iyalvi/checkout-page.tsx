import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Landmark,
  MapPin,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand, Kolam } from "@/components/iyalvi/motifs";
import { LoginDialog } from "@/components/iyalvi/account-control";
import { formatPrice, products } from "@/data/products";
import { usePrototype, type CustomerAddress } from "@/data/store";

type CheckoutStep = "details" | "payment" | "done";
type PaymentMethod = "UPI" | "Card" | "Net Banking" | "Cash on Delivery";

const paymentMethods: { name: PaymentMethod; icon: typeof Smartphone; note: string }[] = [
  { name: "UPI", icon: Smartphone, note: "Pay using any UPI app" },
  { name: "Card", icon: CreditCard, note: "Credit or debit card" },
  { name: "Net Banking", icon: Landmark, note: "Choose your bank" },
  { name: "Cash on Delivery", icon: MapPin, note: "Pay when your order arrives" },
];

export function CheckoutPage() {
  const navigate = useNavigate();
  const customer = usePrototype((state) => state.customer);
  const bag = usePrototype((state) => state.bag);
  const addresses = usePrototype((state) => state.addresses);
  const saveAddress = usePrototype((state) => state.saveAddress);
  const addDemoOrder = usePrototype((state) => state.addDemoOrder);
  const clearBag = usePrototype((state) => state.clearBag);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("details");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [paymentValue, setPaymentValue] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [orderId, setOrderId] = useState("");
  const [completedTotal, setCompletedTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.resolve(usePrototype.persist.rehydrate()).then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!customer) {
      setLoginOpen(true);
      return;
    }
    setName((current) => current || customer.name);
    setMobile((current) => current || customer.mobile);
    const firstAddress = addresses[0];
    if (firstAddress) {
      setName((current) => current || firstAddress.name);
      setMobile((current) => current || firstAddress.mobile);
      setAddress((current) => current || firstAddress.address);
      setPincode((current) => current || firstAddress.pincode);
    }
  }, [ready, customer, addresses]);

  const bagItems = bag.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.id);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const total = bagItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const stepIndex = step === "details" ? 1 : step === "payment" ? 2 : 3;

  const continueToPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pincode)) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }
    const saved: CustomerAddress = {
      id: `address-${Date.now()}`,
      name: name.trim(),
      mobile: mobile.trim(),
      address: address.trim(),
      pincode,
    };
    saveAddress(saved);
    setStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const placeDemoOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (method !== "Cash on Delivery" && !paymentValue.trim()) {
      setError(
        method === "UPI"
          ? "Enter your UPI ID to continue."
          : "Add your payment details to continue.",
      );
      return;
    }
    setError("");
    const id = `IY-${Date.now().toString().slice(-7)}`;
    setOrderId(id);
    setCompletedTotal(total);
    addDemoOrder({
      id,
      date: new Date().toLocaleDateString("en-IN"),
      total,
      itemCount: bagItems.reduce((sum, item) => sum + item.quantity, 0),
      paymentMethod: method,
      status: "Confirmed",
      address: {
        id: `address-${Date.now()}`,
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        pincode,
      },
    });
    clearBag();
    setStep("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!ready) return <main className="checkout-loading">Getting your checkout ready…</main>;

  if (!customer) {
    return (
      <main className="checkout-gate">
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
        <Brand />
        <h1>Sign in to check out</h1>
        <p>Log in to confirm your details and finish your order.</p>
        <Button onClick={() => setLoginOpen(true)}>Sign in to continue</Button>
        <Link to="/">Back to shopping</Link>
      </main>
    );
  }

  if (bagItems.length === 0 && step !== "done") {
    return (
      <main className="checkout-gate">
        <Brand />
        <h1>Your bag is empty</h1>
        <p>Find something that feels like you, then come back to check out.</p>
        <Link to="/" className="checkout-back-link">
          Back to shopping <ArrowRight />
        </Link>
      </main>
    );
  }

  return (
    <main className={`checkout-page checkout-step-${step}`}>
      <header className="checkout-header">
        <Link to="/" aria-label="Back to IYALVI home">
          <Brand />
        </Link>
        <span>YOUR BAG, YOUR WAY</span>
      </header>
      <nav className="checkout-progress" aria-label="Checkout progress">
        {(["Cart", "Details", "Payment", "Done"] as const).map((label, index) => {
          const current = index === stepIndex;
          const complete = index < stepIndex;
          return (
            <div
              key={label}
              className={`checkout-progress-step ${current ? "is-current" : ""} ${complete ? "is-complete" : ""}`}
            >
              <span>{complete ? <Check /> : index + 1}</span>
              <small>{label}</small>
            </div>
          );
        })}
      </nav>
      <div className="checkout-content">
        {step === "details" && (
          <motion.section
            className="checkout-form-panel"
            key="details"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
          >
            <span className="eyebrow">STEP 1 · CONFIRM DETAILS</span>
            <h1 className="checkout-heading">Where should we send it?</h1>
            <p className="checkout-intro">Check your contact details and delivery address.</p>
            <form className="checkout-form" onSubmit={continueToPayment}>
              <div className="checkout-field">
                <Label htmlFor="checkout-name">Full name</Label>
                <Input
                  id="checkout-name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="checkout-field">
                <Label htmlFor="checkout-mobile">Mobile number</Label>
                <Input
                  id="checkout-mobile"
                  type="tel"
                  autoComplete="tel"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  required
                />
              </div>
              <div className="checkout-field checkout-field-wide">
                <Label htmlFor="checkout-address">Delivery address</Label>
                <Input
                  id="checkout-address"
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House, street, area and city"
                  required
                />
              </div>
              <div className="checkout-field">
                <Label htmlFor="checkout-pincode">Pincode</Label>
                <Input
                  id="checkout-pincode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={pincode}
                  onChange={(event) =>
                    setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                />
              </div>
              {error && (
                <p className="form-error checkout-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="checkout-next-button">
                Continue to payment <ArrowRight />
              </Button>
            </form>
          </motion.section>
        )}
        {step === "payment" && (
          <motion.section
            className="checkout-form-panel"
            key="payment"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
          >
            <span className="eyebrow">STEP 2 · PAYMENT</span>
            <h1 className="checkout-heading">How would you like to pay?</h1>
            <p className="checkout-intro">Choose a payment method to complete this demo order.</p>
            <form className="checkout-form payment-form" onSubmit={placeDemoOrder}>
              <div className="payment-method-list">
                {paymentMethods.map(({ name: option, icon: Icon, note }) => (
                  <label
                    className={`payment-method ${method === option ? "is-selected" : ""}`}
                    key={option}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={option}
                      checked={method === option}
                      onChange={() => {
                        setMethod(option);
                        setPaymentValue("");
                        setError("");
                      }}
                    />
                    <Icon />
                    <span>
                      <strong>{option}</strong>
                      <small>{note}</small>
                    </span>
                  </label>
                ))}
              </div>
              {method !== "Cash on Delivery" && (
                <div className="checkout-field">
                  <Label htmlFor="payment-value">
                    {method === "UPI" ? "UPI ID" : method === "Card" ? "Card number" : "Bank name"}
                  </Label>
                  {method === "Net Banking" ? (
                    <select
                      id="payment-value"
                      value={paymentValue}
                      onChange={(event) => setPaymentValue(event.target.value)}
                      required
                    >
                      <option value="">Choose your bank</option>
                      <option>State Bank of India</option>
                      <option>HDFC Bank</option>
                      <option>ICICI Bank</option>
                      <option>Axis Bank</option>
                    </select>
                  ) : (
                    <Input
                      id="payment-value"
                      value={paymentValue}
                      onChange={(event) => setPaymentValue(event.target.value)}
                      placeholder={method === "UPI" ? "name@bank" : "Enter demo payment details"}
                      required
                    />
                  )}
                </div>
              )}
              <p className="demo-payment-note">Demo only: no payment will be processed.</p>
              {error && (
                <p className="form-error checkout-error" role="alert">
                  {error}
                </p>
              )}
              <div className="checkout-form-actions">
                <Button type="button" variant="outline" onClick={() => setStep("details")}>
                  <ArrowLeft />
                  Back to details
                </Button>
                <Button type="submit" className="checkout-next-button">
                  {method === "Cash on Delivery" ? "Place demo order" : "Pay"} ·{" "}
                  {formatPrice(total)}
                  <ArrowRight />
                </Button>
              </div>
            </form>
          </motion.section>
        )}
        {step === "done" && (
          <motion.section
            className="checkout-success"
            key="done"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="confetti-layer" aria-hidden="true">
              {Array.from({ length: 34 }, (_, index) => (
                <motion.i
                  key={index}
                  style={{
                    left: `${(index * 37) % 100}%`,
                    backgroundColor: [
                      "var(--gold)",
                      "var(--kumkum)",
                      "var(--teal)",
                      "var(--maroon)",
                    ][index % 4],
                  }}
                  initial={{ y: -30, opacity: 0, rotate: 0 }}
                  animate={{
                    y: 300 + (index % 5) * 70,
                    opacity: [0, 1, 1, 0],
                    rotate: 260 + index * 17,
                  }}
                  transition={{
                    duration: 2.4 + (index % 4) * 0.25,
                    delay: (index % 8) * 0.08,
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                />
              ))}
            </div>
            <span className="checkout-success-icon">
              <Check />
            </span>
            <span className="eyebrow">STEP 3 · ALL DONE</span>
            <h1>You’re all set!</h1>
            <p>
              Your demo order <strong>{orderId}</strong> is confirmed. We can’t wait for you to wear
              it.
            </p>
            <div className="success-order-card">
              <span>Order total</span>
              <strong>{formatPrice(completedTotal)}</strong>
              <span>Payment</span>
              <strong>{method}</strong>
            </div>
            <Button onClick={() => void navigate({ to: "/" })}>
              Back to shopping <ArrowRight />
            </Button>
          </motion.section>
        )}
        {step !== "done" && (
          <aside className="checkout-summary">
            <div className="checkout-summary-title">
              <h2>Your order</h2>
              <span>{bagItems.reduce((sum, item) => sum + item.quantity, 0)} items</span>
            </div>
            <div className="checkout-summary-items">
              {bagItems.map(({ product, quantity }) => (
                <div className="checkout-summary-item" key={product.id}>
                  <img src={product.image} alt={product.name} width={54} height={68} />
                  <span>
                    <strong>{product.name}</strong>
                    <small>
                      {product.fabric} · Qty {quantity}
                    </small>
                  </span>
                  <b>{formatPrice(product.price * quantity)}</b>
                </div>
              ))}
            </div>
            <div className="checkout-summary-total">
              <span>Subtotal</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <small>Shipping calculated after you confirm your address.</small>
            {step === "payment" && (
              <div className="checkout-delivery-address">
                <MapPin />
                <span>
                  {name}
                  <small>
                    {address}, {pincode}
                  </small>
                </span>
              </div>
            )}
          </aside>
        )}
      </div>
      <footer className="checkout-footer">
        <Kolam />
        <span>Front-end preview · sign-in and payment are simulated.</span>
        <Link to="/">Keep shopping</Link>
      </footer>
    </main>
  );
}
