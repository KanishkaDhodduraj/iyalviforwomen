import { z } from "zod";
import type { Product } from "@/data/products";

const apiErrorSchema = z.object({ error: z.string() }).passthrough();
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let refreshRequest: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isVerified: boolean;
  phone?: string;
}

export interface ApiAddress {
  _id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface ApiProduct {
  _id: string;
  slug: string;
  name: string;
  category: "saree" | "kurti";
  subCategory: string;
  fabric: string;
  occasion: string;
  colors: string[];
  sizes: string[];
  price: number;
  mrp: number;
  images: string[];
  stock: number;
  isActive: boolean;
  craft?: string;
  craftOrigin?: string;
}

export interface ApiOrder {
  _id: string;
  items: Array<{ name: string; qty: number; unitPrice: number }>;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentMethod: "COD" | "UPI" | "CARD" | "NET_BANKING" | "RAZORPAY";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  orderStatus: "placed" | "packed" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
}

interface RequestOptions extends Omit<RequestInit, "body" | "credentials"> {
  body?: unknown;
  retryAuth?: boolean;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    throw new ApiError(
      parsed.success
        ? parsed.data.error
        : response.status === 502 || response.status === 503 || response.status === 504
          ? "The backend service is unavailable. Start or check the backend server, then try again."
          : "Something went wrong. Please try again.",
      response.status,
    );
  }
  return payload as T;
}

async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        "Cannot reach the backend service. Start or check the backend server, then try again.",
        0,
      );
    }
    throw error;
  }
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = fetchApi("/api/auth/csrf", { credentials: "include" })
      .then(readResponse<{ csrfToken: string }>)
      .then((result) => {
        csrfToken = result.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      try {
        const token = await getCsrfToken();
        const response = await fetchApi("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "x-csrf-token": token },
          body: "{}",
        });
        return response.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, retryAuth = true, headers: inputHeaders, ...init } = options;
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(inputHeaders);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-csrf-token", await getCsrfToken());
  }

  const response = await fetchApi(`/api${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (
    response.status === 401 &&
    retryAuth &&
    path !== "/auth/refresh" &&
    path !== "/auth/login" &&
    path !== "/auth/register"
  ) {
    if (await refreshSession()) return apiRequest<T>(path, { ...options, retryAuth: false });
  }
  return readResponse<T>(response);
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    apiRequest<T>(path, { method: "POST", body, headers }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
  clearCsrf: () => {
    csrfToken = null;
  },
};

export async function getAllProducts(
  query: URLSearchParams = new URLSearchParams(),
): Promise<ApiProduct[]> {
  const params = new URLSearchParams(query);
  params.set("page", "1");
  params.set("limit", "50");
  const firstPage = await api.get<{
    products: ApiProduct[];
    total: number;
  }>(`/products?${params.toString()}`);
  const products = [...firstPage.products];
  const pageCount = Math.ceil(firstPage.total / 50);
  for (let page = 2; page <= pageCount; page += 1) {
    params.set("page", String(page));
    const result = await api.get<{ products: ApiProduct[] }>(`/products?${params.toString()}`);
    products.push(...result.products);
  }
  return products;
}

export function productFromApi(product: ApiProduct): Product {
  const category: Product["category"] = product.category === "saree" ? "Sarees" : "Kurtis";
  return {
    id: product._id,
    name: product.name,
    fabric: product.fabric,
    price: product.price,
    occasion: product.occasion as Product["occasion"],
    colors: [...product.colors],
    craftOrigin: product.craftOrigin ?? "",
    sizes: [...product.sizes],
    image: product.images[0] ?? "",
    unsplashImage: product.images[0] ?? "",
    craft: product.craft ?? product.subCategory,
    category,
    subcategory: product.subCategory as Product["subcategory"],
    ...(product.mrp > product.price && { originalPrice: product.mrp }),
  };
}

export function apiProductForCartItem(
  productId: string,
  catalog: ApiProduct[],
): ApiProduct | undefined {
  return (
    catalog.find((product) => product._id === productId) ??
    catalog.find((product) => product.slug.startsWith(`${productId}-`))
  );
}

export function productIdToApiSlug(id: string, products: ApiProduct[]): string | undefined {
  return products.find((product) => product._id === id)?.slug;
}
