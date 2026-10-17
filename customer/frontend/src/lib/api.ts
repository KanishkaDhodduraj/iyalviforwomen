import { z } from "zod";
import type { Product } from "@/data/products";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api` : "/api";
const apiErrorSchema = z
  .object({ error: z.string().optional(), message: z.string().optional() })
  .passthrough();
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let refreshRequest: Promise<boolean> | null = null;
const publicReadCache = new Map<string, { expiresAt: number; value: unknown }>();
const publicReadRequests = new Map<string, Promise<unknown>>();
const PUBLIC_READ_CACHE_TTL = 60_000;

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
  category?: "saree" | "kurti";
  subCategory: string;
  fabric: string;
  colors: string[];
  sizes: string[];
  sizeStock: Record<string, { inStock: boolean; lowStock: number | null }>;
  inStock: boolean;
  lowStock: number | null;
  price: number;
  mrp: number;
  originalPrice?: number;
  offerEndsAt?: string;
  images: Array<
    | string
    | {
        url: string;
        alt?: string;
        isPrimary: boolean;
        thumbnailUrl?: string;
      }
  >;
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
  paymentMethod: "COD" | "UPI" | "CARD" | "NETBANKING" | "RAZORPAY";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  orderStatus: "placed" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled";
  createdAt: string;
  courier?: string;
  trackingNumber?: string;
  statusHistory?: Array<{ status: ApiOrder["orderStatus"]; at: string; note?: string }>;
}

export interface ApiReel {
  _id: string;
  title: string;
  shortcode: string;
  instagramUrl: string;
  order: number;
  isActive: boolean;
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
    if (response.status === 429) {
      throw new ApiError("Too many requests, please wait a moment", response.status);
    }
    throw new ApiError(
      parsed.success
        ? (parsed.data.message ?? parsed.data.error ?? "Something went wrong. Please try again.")
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
    csrfRequest = fetchApi(`${apiUrl}/auth/csrf`, { credentials: "include" })
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
        const response = await fetchApi(`${apiUrl}/auth/refresh`, {
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

function isCacheablePublicRead(path: string, method: string): boolean {
  if (method !== "GET") return false;
  return /^\/(?:products(?:\/[^/?]+)?|discounts|reels)(?:\?|$|\/)/.test(path);
}

async function performApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, retryAuth = true, headers: inputHeaders, ...init } = options;
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(inputHeaders);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-csrf-token", await getCsrfToken());
  }

  const response = await fetchApi(`${apiUrl}${path}`, {
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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (options.retryAuth === false || !isCacheablePublicRead(path, method)) {
    return performApiRequest<T>(path, options);
  }

  const cached = publicReadCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  if (cached) publicReadCache.delete(path);

  const pending = publicReadRequests.get(path);
  if (pending) return pending as Promise<T>;

  const request = performApiRequest<T>(path, options)
    .then((value) => {
      publicReadCache.set(path, { expiresAt: Date.now() + PUBLIC_READ_CACHE_TTL, value });
      return value;
    })
    .finally(() => publicReadRequests.delete(path));
  publicReadRequests.set(path, request);
  return request;
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
  clearPublicReadCache: () => {
    publicReadCache.clear();
    publicReadRequests.clear();
  },
};

export async function getAllProducts(
  query: URLSearchParams = new URLSearchParams(),
): Promise<ApiProduct[]> {
  const params = new URLSearchParams(query);
  if (!params.has("sort")) params.set("sort", "newest");
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
  const category: Product["category"] = product.category === "kurti" ? "Kurtis" : "Sarees";
  const images = product.images.map((image) => (typeof image === "string" ? image : image.url));
  const sizes = product.sizes;
  return {
    id: product._id,
    slug: product.slug,
    name: product.name,
    fabric: product.fabric,
    price: product.price,
    colors: [...product.colors],
    craftOrigin: product.craftOrigin ?? "",
    sizes,
    sizeStock: product.sizeStock,
    inStock: product.inStock,
    lowStock: product.lowStock,
    image: images[0] ?? "",
    images,
    craft: product.craft ?? product.subCategory,
    category,
    subcategory: product.subCategory as Product["subcategory"],
    ...((product.originalPrice ?? product.mrp) > product.price && {
      originalPrice: product.originalPrice ?? product.mrp,
    }),
    ...(product.offerEndsAt && { offerEndsAt: product.offerEndsAt }),
  };
}

export function apiProductForCartItem(
  productId: string,
  catalog: ApiProduct[],
): ApiProduct | undefined {
  return catalog.find((product) => product._id === productId);
}

export function productIdToApiSlug(id: string, products: ApiProduct[]): string | undefined {
  return products.find((product) => product._id === id)?.slug;
}
