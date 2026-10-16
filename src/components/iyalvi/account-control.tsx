import { useId, useState, type FormEvent } from "react";
import {
  Check,
  Heart,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Truck,
  UserRound,
  UserRoundPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePrototype, type Customer } from "@/data/store";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const inputId = useId();
  const signInDemo = usePrototype((state) => state.signInDemo);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");

  const finishLogin = (customer: Customer) => {
    signInDemo(customer);
    setError("");
    onOpenChange(false);
    onSuccess?.();
  };

  const continueWithGoogle = () => {
    finishLogin({
      name: "IYALVI Guest",
      email: "guest@example.com",
      mobile: "",
    });
  };

  const requestOtp = () => {
    if (!/^\+?[0-9\s()-]{8,16}$/.test(mobile.trim())) {
      setError("Enter a valid mobile number to continue.");
      return;
    }
    setError("");
    setCodeSent(true);
  };

  const verifyOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code to continue.");
      return;
    }
    finishLogin({
      name: "IYALVI Guest",
      email: "",
      mobile: mobile.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="login-dialog">
        <span className="eyebrow">WELCOME TO IYALVI</span>
        <DialogTitle className="font-display text-4xl">Sign in to continue</DialogTitle>
        <DialogDescription>
          Sign in to check out and keep your account details together.
        </DialogDescription>
        <Button className="google-login-button" variant="outline" onClick={continueWithGoogle}>
          <span className="google-mark" aria-hidden="true">
            G
          </span>
          Continue with Google
        </Button>
        <div className="login-divider">
          <span>or use your mobile number</span>
        </div>
        <form className="otp-form" onSubmit={verifyOtp}>
          <Label htmlFor={`${inputId}-mobile`}>Mobile number</Label>
          <div className="otp-mobile-row">
            <Input
              id={`${inputId}-mobile`}
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              disabled={codeSent}
              required
            />
            {!codeSent ? (
              <Button type="button" variant="outline" onClick={requestOtp}>
                Send OTP
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCodeSent(false);
                  setOtp("");
                }}
              >
                Edit
              </Button>
            )}
          </div>
          {codeSent && (
            <>
              <Label htmlFor={`${inputId}-otp`}>One-time code</Label>
              <Input
                id={`${inputId}-otp`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Enter any 6 digits"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
              <Button type="submit" className="login-submit">
                Verify and continue
              </Button>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
        <p className="demo-auth-note">
          Front-end preview: sign-in is simulated. No message is sent.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function AccountControl({
  onWishlist,
  className = "",
}: {
  onWishlist: () => void;
  className?: string;
}) {
  const customer = usePrototype((state) => state.customer);
  const signOutDemo = usePrototype((state) => state.signOutDemo);
  const [loginOpen, setLoginOpen] = useState(false);
  const [panel, setPanel] = useState<"profile" | "orders" | "addresses" | null>(null);
  const orders = usePrototype((state) => state.orders);
  const addresses = usePrototype((state) => state.addresses);
  const updateProfile = usePrototype((state) => state.updateProfile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileMobile, setProfileMobile] = useState("");
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const trackingOrder = orders.find((order) => order.id === trackingOrderId);

  const startProfileEdit = () => {
    setProfileName(customer?.name ?? "");
    setProfileEmail(customer?.email ?? "");
    setProfileMobile(customer?.mobile ?? "");
    setProfileMessage("");
    setEditingProfile(true);
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    updateProfile({
      name: profileName.trim(),
      email: profileEmail.trim(),
      mobile: profileMobile.trim(),
    });
    setEditingProfile(false);
    setProfileMessage("Your profile has been updated.");
  };

  return (
    <>
      {customer ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`account-trigger ${className}`}
              aria-label="Account menu"
              title="Account"
            >
              <UserRound />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="account-menu">
            <DropdownMenuLabel>{customer.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setPanel("profile")}>
              <UserRoundPen />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPanel("orders")}>
              <Package />
              My Orders
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onWishlist}>
              <Heart />
              Wishlist
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPanel("addresses")}>
              <MapPin />
              Saved Addresses
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOutDemo}>
              <LogOut />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className={`account-trigger ${className}`}
          aria-label="Account"
          title="Account"
          onClick={() => setLoginOpen(true)}
        >
          <UserRound />
        </Button>
      )}
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      <Dialog
        open={Boolean(panel)}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="account-panel-dialog">
          {panel === "profile" && (
            <>
              <span className="eyebrow">YOUR ACCOUNT</span>
              <DialogTitle className="font-display text-4xl">My Profile</DialogTitle>
              <DialogDescription>Your details for a smoother checkout.</DialogDescription>
              {editingProfile ? (
                <form className="profile-edit-form" onSubmit={saveProfile}>
                  <Label htmlFor="profile-name">Name</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    required
                  />
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                  />
                  <Label htmlFor="profile-mobile">Mobile</Label>
                  <Input
                    id="profile-mobile"
                    type="tel"
                    value={profileMobile}
                    onChange={(event) => setProfileMobile(event.target.value)}
                  />
                  <div className="profile-edit-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingProfile(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save changes</Button>
                  </div>
                </form>
              ) : (
                <>
                  <dl className="account-details">
                    <div>
                      <dt>Name</dt>
                      <dd>{customer?.name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{customer?.email || "Not added"}</dd>
                    </div>
                    <div>
                      <dt>Mobile</dt>
                      <dd>{customer?.mobile || "Not added"}</dd>
                    </div>
                  </dl>
                  <Button variant="outline" onClick={startProfileEdit}>
                    <Pencil /> Edit profile
                  </Button>
                </>
              )}
              {profileMessage && (
                <p className="profile-saved-message" role="status">
                  {profileMessage}
                </p>
              )}
            </>
          )}
          {panel === "orders" && (
            <>
              <span className="eyebrow">YOUR ACCOUNT</span>
              <DialogTitle className="font-display text-4xl">My Orders</DialogTitle>
              <DialogDescription>Your recent orders will show up here.</DialogDescription>
              <div className="account-list">
                {orders.map((order) => (
                  <div className="account-list-item" key={order.id}>
                    <strong>{order.id}</strong>
                    <span>
                      {order.itemCount} items · ₹{order.total.toLocaleString("en-IN")}
                    </span>
                    <small>
                      {order.date} · {order.paymentMethod}
                    </small>
                    <span className="order-status-label">
                      <Truck /> {order.status ?? "Confirmed"}
                    </span>
                    <Button variant="outline" onClick={() => setTrackingOrderId(order.id)}>
                      Track order
                    </Button>
                  </div>
                ))}
                {orders.length === 0 && (
                  <p className="account-empty">
                    No orders yet. Your next favourite is just around the corner.
                  </p>
                )}
              </div>
            </>
          )}
          {panel === "addresses" && (
            <>
              <span className="eyebrow">YOUR ACCOUNT</span>
              <DialogTitle className="font-display text-4xl">Saved Addresses</DialogTitle>
              <DialogDescription>Addresses saved during checkout appear here.</DialogDescription>
              <div className="account-list">
                {addresses.map((address) => (
                  <div className="account-list-item" key={address.id}>
                    <strong>
                      {address.name} · {address.mobile}
                    </strong>
                    <span>{address.address}</span>
                    <small>{address.pincode}</small>
                  </div>
                ))}
                {addresses.length === 0 && <p className="account-empty">No saved addresses yet.</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(trackingOrder)}
        onOpenChange={(open) => {
          if (!open) setTrackingOrderId(null);
        }}
      >
        <DialogContent className="tracking-dialog">
          <span className="eyebrow">ORDER JOURNEY</span>
          <DialogTitle className="font-display text-4xl">Track your order</DialogTitle>
          {trackingOrder && (
            <>
              <DialogDescription>
                {trackingOrder.id} · {trackingOrder.date}
              </DialogDescription>
              <div
                className="tracking-timeline"
                aria-label={`Order status: ${trackingOrder.status ?? "Confirmed"}`}
              >
                {(["Confirmed", "Packed", "In transit", "Delivered"] as const).map(
                  (status, index) => {
                    const current = trackingOrder.status ?? "Confirmed";
                    const statuses = ["Confirmed", "Packed", "In transit", "Delivered"] as const;
                    const activeIndex = statuses.indexOf(current);
                    const complete = index <= activeIndex;
                    return (
                      <div
                        className={`tracking-step ${complete ? "is-complete" : ""}`}
                        key={status}
                      >
                        <span>{complete ? <Check /> : index + 1}</span>
                        <div>
                          <strong>{status}</strong>
                          <small>
                            {index === 0
                              ? "Order received"
                              : index === 1
                                ? "Getting ready for dispatch"
                                : index === 2
                                  ? "On its way to you"
                                  : "At your doorstep"}
                          </small>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
              <p className="tracking-demo-note">Demo tracking · status updates are a preview.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
