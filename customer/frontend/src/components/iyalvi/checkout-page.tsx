import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { Brand } from "@/components/iyalvi/motifs";
import { LoginDialog } from "@/components/iyalvi/account-control";
import { formatPrice } from "@/data/products";
import { usePrototype } from "@/data/store";
import {
  api,
  apiProductForCartItem,
  getAllProducts,
  productFromApi,
  type ApiAddress,
  type ApiOrder,
  type ApiProduct,
} from "@/lib/api";
import { z } from "zod";
import { useCustomerTheme } from "@/hooks/use-customer-theme";

type CheckoutStep = "details" | "payment" | "done";
type PaymentMethod = "UPI" | "Card" | "Net Banking" | "Cash on Delivery";
type OrderPaymentMethod = "UPI" | "CARD" | "NETBANKING" | "COD";

const paymentMethods: {
  name: PaymentMethod;
  icon: typeof Smartphone;
  note: string;
}[] = [
  { name: "UPI", icon: Smartphone, note: "Demo only · no charge" },
  { name: "Card", icon: CreditCard, note: "Demo only · no charge" },
  { name: "Net Banking", icon: Landmark, note: "Demo only · no charge" },
  { name: "Cash on Delivery", icon: MapPin, note: "Pay when your order arrives" },
];
const apiMethodLabels: Record<string, PaymentMethod> = {
  COD: "Cash on Delivery",
  UPI: "UPI",
  CARD: "Card",
  NETBANKING: "Net Banking",
};

export function CheckoutPage() {
  useCustomerTheme();
  const navigate = useNavigate();
  const customer = usePrototype((state) => state.customer);
  const bag = usePrototype((state) => state.bag);
  const saveAddress = usePrototype((state) => state.saveAddress);
  const recordOrder = usePrototype((state) => state.recordOrder);
  const hydrateSession = usePrototype((state) => state.hydrateSession);
  const clearBag = usePrototype((state) => state.clearBag);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("details");
  const [method, setMethod] = useState<PaymentMethod>("Cash on Delivery");
  const methodRef = useRef(method);
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>([
    "Cash on Delivery",
  ]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDraft, setCouponDraft] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [serverAddresses, setServerAddresses] = useState<ApiAddress[]>([]);
  const [catalog, setCatalog] = useState<ApiProduct[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [quote, setQuote] = useState<{
    items: Array<{ product: string; unitPrice: number }>;
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [completedTotal, setCompletedTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      Promise.resolve(usePrototype.persist.rehydrate()),
      hydrateSession().catch((error: unknown) => {
        if (active && usePrototype.getState().customer) {
          setOrderError(
            error instanceof Error ? error.message : "Your account could not be loaded.",
          );
        }
      }),
    ]).finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [hydrateSession]);

  useEffect(() => {
    if (ready && !customer) setLoginOpen(true);
  }, [customer, ready]);

  useEffect(() => {
    if (!ready) return;
    if (!customer) {
      setLoginOpen(true);
      return;
    }
    setName((current) => current || customer.name);
    setMobile((current) => current || customer.mobile);
    void api
      .get<{ addresses: ApiAddress[] }>("/addresses")
      .then(({ addresses: saved }) => {
        setServerAddresses(saved);
        const primary = saved.find((item) => item.isDefault) ?? saved[0];
        if (primary) {
          setSelectedAddressId(primary._id);
          setName(primary.name);
          setMobile(primary.phone);
          setAddress([primary.line1, primary.line2].filter(Boolean).join(", "));
          setCity(primary.city);
          setState(primary.state);
          setPincode(primary.pincode);
        }
      })
      .catch((error: unknown) =>
        setOrderError(
          error instanceof Error ? error.message : "Saved addresses could not be loaded.",
        ),
      );
  }, [ready, customer]);

  useEffect(() => {
    if (!customer) return;
    setCatalog([]);
    setCatalogLoaded(false);
    void getAllProducts()
      .then(setCatalog)
      .catch((error: unknown) =>
        setOrderError(error instanceof Error ? error.message : "Products could not be loaded."),
      )
      .finally(() => setCatalogLoaded(true));
  }, [customer]);

  useEffect(() => {
    let active = true;
    void api
      .get<{ methods: string[] }>("/payment-options")
      .then(({ methods }) => {
        if (active) {
          const allowed = methods.map((value) => apiMethodLabels[value]).filter(Boolean);
          setEnabledPaymentMethods(allowed.length ? allowed : ["Cash on Delivery"]);
          if (!allowed.includes(methodRef.current)) {
            const fallback = allowed[0] ?? "Cash on Delivery";
            methodRef.current = fallback;
            setMethod(fallback);
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setEnabledPaymentMethods(["Cash on Delivery"]);
          methodRef.current = "Cash on Delivery";
          setError(cause instanceof Error ? cause.message : "Payment options could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const bagItems = useMemo(
    () =>
      bag.flatMap((item) => {
        const serverProduct = apiProductForCartItem(item.id, catalog);
        const product = serverProduct ? productFromApi(serverProduct) : undefined;
        return product
          ? [
              {
                product,
                serverProductId: serverProduct?._id,
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
      bagItems.map(({ product, serverProductId, quantity, size, color }) => ({
        productId: serverProductId ?? product.id,
        size,
        color,
        qty: quantity,
      })),
    [bagItems],
  );
  useEffect(() => {
    if (
      !customer ||
      pricingItems.length === 0 ||
      pricingItems.length !== bag.length ||
      bagItems.some((item) => !item.serverProductId)
    ) {
      setQuote(null);
      return;
    }
    let active = true;
    setQuote(null);
    void api
      .post<{
        items: Array<{ product: string; unitPrice: number }>;
        subtotal: number;
        discount: number;
        shipping: number;
        total: number;
      }>("/cart/price", {
        items: pricingItems,
        ...(couponCode.trim() && { couponCode: couponCode.trim() }),
      })
      .then((result) => {
        if (active) setQuote(result);
      })
      .catch((error: unknown) => {
        if (active) {
          setQuote(null);
          setOrderError(
            error instanceof Error ? error.message : "The order price could not be checked.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [customer, bag.length, bagItems, pricingItems, couponCode]);
  const missingServerProducts = bagItems.some((item) => !item.serverProductId);
  const total = quote?.total ?? 0;
  const stepIndex = step === "details" ? 1 : step === "payment" ? 2 : 3;

  const applyCoupon = async () => {
    const code = couponDraft.trim().toUpperCase();
    if (!code || pricingItems.length === 0) {
      setCouponMessage("Enter a coupon code.");
      return;
    }
    setCouponBusy(true);
    setCouponMessage("");
    try {
      await api.post<{ valid: true; code: string; discount: number; total: number }>(
        "/coupons/validate",
        { code, items: pricingItems },
      );
      setCouponCode(code);
      setCouponDraft(code);
      setCouponMessage("Coupon applied. Your order total is being refreshed.");
      setError("");
    } catch (cause) {
      setCouponCode("");
      setCouponMessage(
        cause instanceof Error ? cause.message : "This coupon could not be validated.",
      );
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setCouponCode("");
    setCouponDraft("");
    setCouponMessage("Coupon removed.");
  };

  const continueToPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const schema = z.object({
      name: z.string().trim().min(1).max(100),
      phone: z
        .string()
        .transform((value) => value.replace(/[\s()-]/g, ""))
        .pipe(z.string().regex(/^\+?[1-9]\d{7,14}$/)),
      line1: z.string().trim().min(1).max(200),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(1).max(100),
      pincode: z.string().regex(/^\d{6}$/),
    });
    const parsed = schema.safeParse({ name, phone: mobile, line1: address, city, state, pincode });
    if (!parsed.success) {
      setError("Check your name, phone number, address, city, state and 6-digit pincode.");
      return;
    }
    try {
      let addressId = selectedAddressId;
      if (!addressId || !serverAddresses.some((item) => item._id === addressId)) {
        const { address: saved } = await api.post<{ address: ApiAddress }>("/addresses", {
          ...parsed.data,
          phone: parsed.data.phone,
          line2: "",
          isDefault: serverAddresses.length === 0,
        });
        addressId = saved._id;
        setServerAddresses((items) => [saved, ...items]);
        saveAddress({
          id: saved._id,
          name: saved.name,
          mobile: saved.phone,
          address: [saved.line1, saved.line2, saved.city, saved.state].filter(Boolean).join(", "),
          pincode: saved.pincode,
        });
      }
      setSelectedAddressId(addressId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save this address.");
      return;
    }
    setStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAddressId || !quote) {
      setError("Confirm an address and verify the final order total before placing your order.");
      return;
    }
    setSubmitting(true);
    setError("");
    setOrderError("");
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const { order } = await api.post<{ order: ApiOrder }>(
        "/orders",
        {
          items: pricingItems,
          addressId: selectedAddressId,
          ...(couponCode.trim() && { couponCode: couponCode.trim() }),
          paymentMethod: paymentMethodToApi(method),
        },
        { "Idempotency-Key": idempotencyKey.current },
      );
      setOrderId(order._id);
      setCompletedTotal(order.total);
      recordOrder(order);
      clearBag();
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your order could not be placed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) return <main className="checkout-loading">Getting your checkout ready…</main>;

  if (!customer) {
    return (
      <main className="checkout-gate">
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
        <Brand compact />
        <h1>Sign in to check out</h1>
        <p>Log in to confirm your details and finish your order.</p>
        <Button onClick={() => setLoginOpen(true)}>Sign in to continue</Button>
        <Link to="/">Back to shopping</Link>
      </main>
    );
  }

  if (catalogLoaded && bagItems.length === 0 && step !== "done") {
    return (
      <main className="checkout-gate">
        <Brand compact />
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
          <Brand compact />
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
            <form className="checkout-form" onSubmit={(event) => void continueToPayment(event)}>
              {serverAddresses.length > 0 && (
                <div className="checkout-field checkout-field-wide">
                  <Label htmlFor="saved-address">Saved address</Label>
                  <select
                    id="saved-address"
                    value={selectedAddressId}
                    onChange={(event) => {
                      const selected = serverAddresses.find(
                        (item) => item._id === event.target.value,
                      );
                      setSelectedAddressId(selected?._id ?? "");
                      if (selected) {
                        setName(selected.name);
                        setMobile(selected.phone);
                        setAddress([selected.line1, selected.line2].filter(Boolean).join(", "));
                        setCity(selected.city);
                        setState(selected.state);
                        setPincode(selected.pincode);
                      }
                    }}
                  >
                    <option value="">Add a new address</option>
                    {serverAddresses.map((saved) => (
                      <option key={saved._id} value={saved._id}>
                        {saved.name} · {saved.city} · {saved.pincode}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="checkout-field">
                <Label htmlFor="checkout-name">Full name</Label>
                <Input
                  id="checkout-name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => {
                    setSelectedAddressId("");
                    setName(event.target.value);
                  }}
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
                  onChange={(event) => {
                    setSelectedAddressId("");
                    setMobile(event.target.value);
                  }}
                  required
                />
              </div>
              <div className="checkout-field checkout-field-wide">
                <Label htmlFor="checkout-address">Delivery address</Label>
                <Input
                  id="checkout-address"
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => {
                    setSelectedAddressId("");
                    setAddress(event.target.value);
                  }}
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
                  onChange={(event) => {
                    setSelectedAddressId("");
                    setPincode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  }}
                  required
                />
              </div>
              <div className="checkout-field">
                <Label htmlFor="checkout-city">City</Label>
                <Input
                  id="checkout-city"
                  value={city}
                  onChange={(event) => {
                    setSelectedAddressId("");
                    setCity(event.target.value);
                  }}
                  required
                />
              </div>
              <div className="checkout-field">
                <Label htmlFor="checkout-state">State</Label>
                <Input
                  id="checkout-state"
                  value={state}
                  onChange={(event) => {
                    setSelectedAddressId("");
                    setState(event.target.value);
                  }}
                  required
                />
              </div>
              {orderError && (
                <p className="form-error checkout-error" role="alert">
                  {orderError}
                </p>
              )}
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
            <p className="checkout-intro">Choose a payment option.</p>
            <form
              className="checkout-form payment-form"
              onSubmit={(event) => void placeOrder(event)}
            >
              <div className="payment-method-list">
                {paymentMethods
                  .filter(({ name }) => enabledPaymentMethods.includes(name))
                  .map(({ name: option, icon: Icon, note }) => (
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
                          methodRef.current = option;
                          setMethod(option);
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
              <div className="checkout-coupon">
                <label className="checkout-field" htmlFor="checkout-coupon-code">
                  Coupon code
                </label>
                <div className="checkout-coupon-controls">
                  <Input
                    id="checkout-coupon-code"
                    value={couponDraft}
                    onChange={(event) => {
                      setCouponDraft(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_-]/g, "")
                          .slice(0, 40),
                      );
                      setCouponMessage("");
                    }}
                    maxLength={40}
                    disabled={couponBusy}
                  />
                  {couponCode ? (
                    <Button
                      type="button"
                      variant="link"
                      className="coupon-remove-link"
                      onClick={removeCoupon}
                      disabled={couponBusy}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void applyCoupon()}
                      disabled={couponBusy || !couponDraft.trim() || !pricingItems.length}
                    >
                      {couponBusy ? "Checking…" : "Apply"}
                    </Button>
                  )}
                </div>
                {couponMessage && (
                  <p className={couponCode ? "coupon-success" : "form-error"} role="status">
                    {couponMessage}
                  </p>
                )}
              </div>
              <p className="demo-payment-note">Demo mode: no real payment is taken.</p>
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
                <Button
                  type="submit"
                  className="checkout-next-button"
                  disabled={submitting || !quote}
                >
                  {submitting
                    ? "Placing order…"
                    : method === "Cash on Delivery"
                      ? "Place COD order"
                      : "Place order"}{" "}
                  · {formatPrice(total)}
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
              Your order <strong>{orderId}</strong> is confirmed.
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
                  <b>
                    {quote
                      ? formatPrice(
                          (quote.items.find((item) => item.product === product.id)?.unitPrice ??
                            0) * quantity,
                        )
                      : "—"}
                  </b>
                </div>
              ))}
            </div>
            <div className="checkout-summary-total">
              <span>Subtotal</span>
              <strong>{quote ? formatPrice(quote.subtotal) : "—"}</strong>
            </div>
            {quote && (
              <>
                <div className="checkout-summary-total">
                  <span>Discount</span>
                  <strong>−{formatPrice(quote.discount)}</strong>
                </div>
                <div className="checkout-summary-total">
                  <span>Shipping</span>
                  <strong>{quote.shipping ? formatPrice(quote.shipping) : "Free"}</strong>
                </div>
                <div className="checkout-summary-total">
                  <span>Total</span>
                  <strong>{formatPrice(quote.total)}</strong>
                </div>
              </>
            )}
            {orderError && (
              <p className="form-error" role="alert">
                {orderError}
              </p>
            )}
            {!quote && (
              <small>
                {catalogLoaded && missingServerProducts
                  ? "This style is not available in the store catalog yet. Please contact support before placing your order."
                  : "Secure server pricing will appear once your products are loaded."}
              </small>
            )}
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
        <span>Checkout</span>
        <Link to="/">Keep shopping</Link>
      </footer>
    </main>
  );
}

function paymentMethodToApi(method: PaymentMethod): OrderPaymentMethod {
  switch (method) {
    case "UPI":
      return "UPI";
    case "Card":
      return "CARD";
    case "Net Banking":
      return "NETBANKING";
    case "Cash on Delivery":
      return "COD";
  }
}
