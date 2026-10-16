import { z } from "zod";

export interface AdminUser {
  id: string;
  email: string;
  role: "superadmin" | "manager" | "support";
}

export interface PageResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function readCsrfToken(cookie = document.cookie): string {
  const match = cookie.match(/(?:^|;\s*)admin_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

type Fetcher = typeof fetch;

export class AdminApiClient {
  private refreshPromise: Promise<boolean> | null = null;

  constructor(
    private readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "/api",
  ) {}

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: { retry?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    const method = (init.method ?? "GET").toUpperCase();
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      headers.set("x-csrf-token", readCsrfToken());
    }
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        method,
        headers,
        credentials: "include",
      });
    } catch {
      throw new ApiError("Admin service is offline or unreachable. Check your connection and try again.");
    }
    if (response.status === 401 && options.retry !== false && path !== "/auth/login") {
      const refreshed = await this.refresh();
      if (refreshed) return this.request<T>(path, init, { retry: false });
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      throw new ApiError(data?.error ?? `Request failed (${response.status})`, response.status);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private refresh(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.request<{ admin: AdminUser }>("/auth/refresh", {
        method: "POST",
      }, { retry: false })
        .then(() => true)
        .catch(() => false)
        .finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  upload<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>(path, { method: "POST", body: formData });
  }

  async downloadResponse(path: string, retry = true): Promise<Response> {
    const headers = new Headers();
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        credentials: "include",
        headers,
      });
    } catch {
      throw new ApiError("Admin service is offline or unreachable. Check your connection and try again.");
    }
    if (response.status === 401 && retry) {
      const refreshed = await this.refresh();
      if (refreshed) return this.downloadResponse(path, false);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      throw new ApiError(data?.error ?? "Export could not be downloaded.", response.status);
    }
    return response;
  }

  async saveDownload(path: string, filename: string): Promise<void> {
    const response = await this.downloadResponse(path);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
}).strict();

export const adminApi = new AdminApiClient();
export const loginInputSchema = loginSchema;

export const authApi = {
  login(email: string, password: string) {
    const credentials = loginSchema.parse({ email, password });
    return adminApi.post<{ admin: AdminUser }>("/auth/login", credentials);
  },
  me: () => adminApi.get<{ admin: AdminUser }>("/auth/me"),
  logout: () => adminApi.post<void>("/auth/logout"),
  devLogin: () => adminApi.post<{ admin: AdminUser }>("/auth/dev-login"),
};
