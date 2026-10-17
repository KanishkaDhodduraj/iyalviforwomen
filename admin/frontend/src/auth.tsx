import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { ApiError, authApi, loginInputSchema, signedInThisSessionKey, type AdminUser } from "./api";

export const authKey = ["auth", "me"] as const;
export type LoginFields = z.infer<typeof loginInputSchema>;

export function useAdmin() {
  return useQuery({
    queryKey: authKey,
    queryFn: async () => (await authApi.me()).admin,
    retry: false,
    staleTime: 60_000,
    enabled: sessionStorage.getItem(signedInThisSessionKey) === "true",
  });
}

export function ProtectedRoute() {
  const auth = useAdmin();
  if (sessionStorage.getItem(signedInThisSessionKey) !== "true") return <Navigate to="/login" replace />;
  if (auth.isLoading) return <div className="auth-loading"><span className="spinner" />Verifying secure session…</div>;
  if (auth.isError || !auth.data) {
    const connectionIssue = auth.error instanceof ApiError && auth.error.status === undefined ? auth.error.message : undefined;
    return <Navigate to="/login" replace state={{ connectionIssue }} />;
  }
  return <Outlet />;
}

export function LoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const auth = useAdmin();
  const form = useForm<LoginFields>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: "", password: "" },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try {
      const result = await authApi.login(values.email, values.password);
      sessionStorage.setItem(signedInThisSessionKey, "true");
      queryClient.setQueryData<AdminUser>(authKey, result.admin);
      await navigate("/dashboard", { replace: true });
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "Sign-in failed. Please try again." });
    }
  });
  const hasSession = sessionStorage.getItem(signedInThisSessionKey) === "true";
  if (hasSession && auth.isLoading) return <div className="auth-loading"><span className="spinner" />Verifying secure session…</div>;
  if (hasSession && auth.data) return <Navigate to="/dashboard" replace />;
  const authIssue = auth.isError && auth.error instanceof ApiError && auth.error.status === undefined
    ? auth.error.message
    : undefined;
  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand-mark">I</div>
        <span className="eyebrow">IYALVI ADMINISTRATION</span>
        <h1>Welcome back</h1>
        <p>Sign in with your admin account to manage the storefront.</p>
        <label htmlFor="email">Email address</label>
        <input id="email" autoComplete="username" type="email" {...form.register("email")} />
        {form.formState.errors.email && <small className="field-error">{form.formState.errors.email.message}</small>}
        <label htmlFor="password">Password</label>
        <input id="password" autoComplete="current-password" type="password" {...form.register("password")} />
        {form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}
        {authIssue && <p role="alert" className="inline-error">{authIssue}</p>}
        {form.formState.errors.root && <p role="alert" className="inline-error">{form.formState.errors.root.message}</p>}
        <button className="primary-button login-button" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing in…" : "Sign in"} {form.formState.isSubmitting ? <LockKeyhole size={16} /> : <ArrowRight size={17} />}
        </button>
        <small>Admin access is provisioned securely by your system administrator.</small>
      </form>
    </main>
  );
}
