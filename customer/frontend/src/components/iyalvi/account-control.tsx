import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
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
import { usePrototype } from "@/data/store";
import { api, type ApiUser } from "@/lib/api";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const inputId = useId();
  const setCustomer = usePrototype((state) => state.setCustomer);
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const schema = registering
      ? z.object({
          name: z.string().trim().min(1).max(100),
          email: z.string().trim().email().max(254),
          password: z.string().min(8).max(128),
        })
      : z.object({
          email: z.string().trim().email().max(254),
          password: z.string().min(1).max(128),
        });
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(
        registering
          ? "Enter your name, a valid email and a password of at least 8 characters."
          : "Enter a valid email and password.",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { user } = await api.post<{ user: ApiUser }>(
        registering ? "/auth/register" : "/auth/login",
        parsed.data,
      );
      setCustomer({ name: user.name, email: user.email, mobile: user.phone ?? "" });
      onOpenChange(false);
      onSuccess?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="login-dialog">
        <span className="eyebrow">WELCOME TO IYALVI</span>
        <DialogTitle className="font-display text-4xl">
          {registering ? "Create your account" : "Sign in to continue"}
        </DialogTitle>
        <DialogDescription>
          Sign in to check out and keep your account details together.
        </DialogDescription>
        <Button className="google-login-button" variant="outline" disabled>
          <span className="google-mark" aria-hidden="true">
            G
          </span>
          Continue with Google · Coming soon
        </Button>
        <div className="login-divider">
          <span>or use your email</span>
        </div>
        <form className="otp-form" onSubmit={(event) => void submit(event)}>
          {registering && (
            <>
              <Label htmlFor={`${inputId}-name`}>Name</Label>
              <Input
                id={`${inputId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </>
          )}
          <Label htmlFor={`${inputId}-email`}>Email address</Label>
          <Input
            id={`${inputId}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Label htmlFor={`${inputId}-password`}>Password</Label>
          <Input
            id={`${inputId}-password`}
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 8 : 1}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Please wait…" : registering ? "Create account" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="link"
            disabled={loading}
            onClick={() => {
              setRegistering((value) => !value);
              setError("");
            }}
          >
            {registering ? "Already have an account? Sign in" : "New here? Create an account"}
          </Button>
          <div className="login-divider">
            <span>Mobile OTP · Coming soon</span>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
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
  const navigate = useNavigate();
  const customer = usePrototype((state) => state.customer);
  const setCustomer = usePrototype((state) => state.setCustomer);
  const hydrateSession = usePrototype((state) => state.hydrateSession);
  const accountError = usePrototype((state) => state.accountError);
  const [loginOpen, setLoginOpen] = useState(false);
  const [panel, setPanel] = useState<"profile" | "orders" | "addresses" | null>(null);
  const orders = usePrototype((state) => state.orders);
  const addresses = usePrototype((state) => state.addresses);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileMobile, setProfileMobile] = useState("");
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const trackingOrder = orders.find((order) => order.id === trackingOrderId);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let active = true;
    void hydrateSession().catch((error: unknown) => {
      if (active && usePrototype.getState().customer) {
        setSessionError(
          error instanceof Error ? error.message : "Account details could not be loaded.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [hydrateSession]);

  const signOut = async () => {
    try {
      await api.post("/auth/logout", {});
      setCustomer(null);
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Could not log out. Please try again.",
      );
    }
  };

  const startProfileEdit = () => {
    setProfileName(customer?.name ?? "");
    setProfileEmail(customer?.email ?? "");
    setProfileMobile(customer?.mobile ?? "");
    setProfileMessage("");
    setEditingProfile(true);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    const parsed = z.string().trim().min(1).max(100).safeParse(profileName);
    if (!parsed.success) {
      setSessionError("Enter a valid name.");
      return;
    }
    setProfileSaving(true);
    try {
      const { user } = await api.patch<{ user: ApiUser }>("/auth/me", { name: parsed.data });
      setCustomer({ name: user.name, email: user.email, mobile: user.phone ?? customer.mobile });
      setEditingProfile(false);
      setProfileMessage("Your profile has been updated.");
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Your profile could not be updated.",
      );
    } finally {
      setProfileSaving(false);
    }
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
            <DropdownMenuItem onSelect={() => void navigate({ to: "/my-orders" })}>
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
            <DropdownMenuItem onSelect={() => void signOut()}>
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
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => {
          void hydrateSession().catch((error: unknown) => {
            if (usePrototype.getState().customer) {
              setSessionError(
                error instanceof Error ? error.message : "Account details could not be loaded.",
              );
            }
          });
        }}
      />
      {customer && (sessionError || accountError) && (
        <p className="form-error" role="alert">
          {sessionError || accountError}
        </p>
      )}
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
                <form className="profile-edit-form" onSubmit={(event) => void saveProfile(event)}>
                  <Label htmlFor="profile-name">Name</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    required
                  />
                  <Label htmlFor="profile-email">Email</Label>
                  <Input id="profile-email" type="email" value={profileEmail} readOnly />
                  <Label htmlFor="profile-mobile">Mobile</Label>
                  <Input id="profile-mobile" type="tel" value={profileMobile} readOnly />
                  <div className="profile-edit-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingProfile(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving ? "Saving…" : "Save changes"}
                    </Button>
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
              <p className="tracking-demo-note">Order updates are shown as they are received.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
