import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductCard, TrunkDialog } from "@/components/iyalvi/discovery";
import { FloatingDiscovery } from "@/components/iyalvi/floating-discovery";
import { NewArrivalsPage } from "@/components/iyalvi/new-arrivals-page";
import { CollectionPage } from "@/components/iyalvi/collection-page";
import { ProductDialog } from "@/components/iyalvi/discovery";
import type { Product } from "@/data/products";
import { usePrototype } from "@/data/store";
import { api, type ApiProduct } from "@/lib/api";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const router = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...router, useNavigate: () => navigateMock };
});

const product: Product = {
  id: "product-id",
  slug: "mayil-saree",
  name: "Mayil Saree",
  fabric: "Silk",
  price: 720,
  originalPrice: 1000,
  colors: ["Teal"],
  craftOrigin: "Handloom",
  sizes: ["Free Size"],
  image: "/uploads/mayil.webp",
  craft: "Handloom",
  category: "Sarees",
  subcategory: "Silk",
  sizeStock: { "Free Size": { inStock: true, lowStock: null } },
  inStock: true,
  lowStock: null,
};

function testRouter(component: () => React.ReactNode) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component,
  });
  const checkoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/checkout",
    component: () => <p>Checkout destination</p>,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, checkoutRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  navigateMock.mockReset();
  sessionStorage.clear();
  usePrototype.getState().clearBag();
  usePrototype.getState().setCustomer(null);
});

describe("customer shopping flows", () => {
  it("requires size and colour, then adds the selected variant and navigates to checkout", async () => {
    usePrototype.getState().clearBag();
    usePrototype.getState().setCustomer({ name: "A Customer", email: "a@example.com", mobile: "" });
    render(<ProductCard product={product} onSelect={() => undefined} />);

    const checkoutButton = screen.getByRole("button", { name: "Checkout now" });
    expect(checkoutButton).toBeEnabled();
    fireEvent.click(checkoutButton);
    expect(screen.getByRole("alert")).toHaveTextContent("Choose size and colour first.");

    fireEvent.change(screen.getByLabelText("Size for Mayil Saree"), {
      target: { value: "Free Size" },
    });
    fireEvent.change(screen.getByLabelText("Colour for Mayil Saree"), {
      target: { value: "Teal" },
    });
    fireEvent.click(checkoutButton);

    expect(usePrototype.getState().bag).toEqual([
      { id: "product-id", quantity: 1, size: "Free Size", color: "Teal" },
    ]);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/checkout" });
  });

  it("shows inline option feedback and adds from a product card before opening the bag", () => {
    const onAdded = vi.fn();
    const notify = vi.fn();
    render(
      <ProductCard
        product={product}
        onSelect={() => undefined}
        onAdded={onAdded}
        notify={notify}
      />,
    );
    const addButton = screen.getByRole("button", { name: "Add to bag" });
    expect(addButton).toBeEnabled();
    fireEvent.click(addButton);
    expect(screen.getByRole("alert")).toHaveTextContent("Choose size and colour first.");
    expect(screen.getByLabelText("Size for Mayil Saree")).toHaveClass("option-required");
    expect(usePrototype.getState().bag).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Size for Mayil Saree"), {
      target: { value: "Free Size" },
    });
    fireEvent.change(screen.getByLabelText("Colour for Mayil Saree"), {
      target: { value: "Teal" },
    });
    fireEvent.click(addButton);
    expect(onAdded).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith("Mayil Saree was added to your bag.");
    expect(usePrototype.getState().bag[0]).toMatchObject({
      id: "product-id",
      size: "Free Size",
      color: "Teal",
    });
  });

  it("completes the wishlist action after a logged-out customer signs in", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      user: { id: "customer-id", name: "A Customer", email: "a@example.com" },
    } as never);
    render(<ProductCard product={product} onSelect={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Mayil Saree" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in", exact: true }));

    await waitFor(() => {
      expect(usePrototype.getState().customer?.email).toBe("a@example.com");
      expect(usePrototype.getState().wishlist).toContain("product-id");
    });
  });

  it.each(["Sarees", "Kurtis"] as const)(
    "keeps product card actions working on the %s page",
    async (category) => {
      vi.spyOn(api, "get").mockResolvedValue({
        products: [
          {
            _id: "product-id",
            slug: "mayil-saree",
            name: "Mayil Saree",
            category: category === "Sarees" ? "saree" : "kurti",
            subCategory: "Silk",
            fabric: "Silk",
            colors: ["Teal"],
            sizes: ["Free Size"],
            price: 720,
            mrp: 1000,
            images: ["/uploads/mayil.webp"],
            inStock: true,
            lowStock: null,
            sizeStock: { "Free Size": { inStock: true, lowStock: null } },
            isActive: true,
          },
        ],
        total: 1,
      } as never);
      vi.spyOn(api, "post").mockImplementation(() => new Promise<never>(() => undefined));
      const router = testRouter(() => <CollectionPage category={category} />);
      render(<RouterProvider router={router} />);

      fireEvent.change(await screen.findByLabelText("Size for Mayil Saree"), {
        target: { value: "Free Size" },
      });
      fireEvent.change(screen.getByLabelText("Colour for Mayil Saree"), {
        target: { value: "Teal" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add to bag" }));
      expect(await screen.findByText(/Your bag/)).toBeInTheDocument();
    },
  );

  it("requires options in Quick View and opens the cart after adding", async () => {
    usePrototype.getState().setCustomer({ name: "A Customer", email: "a@example.com", mobile: "" });
    vi.spyOn(api, "get").mockResolvedValue({ products: [] } as never);
    const onAdded = vi.fn();
    const onClose = vi.fn();
    const notify = vi.fn();
    render(<ProductDialog product={product} onClose={onClose} onAdded={onAdded} notify={notify} />);
    const addButton = screen.getByRole("button", { name: "Add to bag" });
    fireEvent.click(addButton);
    expect(screen.getByRole("alert")).toHaveTextContent("Choose size and colour first.");

    fireEvent.change(screen.getByLabelText("Colour"), { target: { value: "Teal" } });
    fireEvent.change(screen.getByLabelText("Size"), { target: { value: "Free Size" } });
    fireEvent.click(addButton);
    expect(onAdded).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith("Mayil Saree was added to your bag.");
  });

  it("opens sign-in before checkout and continues to checkout after login", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      user: { id: "customer-id", name: "A Customer", email: "a@example.com" },
    } as never);
    usePrototype.getState().setCustomer(null);
    render(<ProductCard product={product} onSelect={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Size for Mayil Saree"), {
      target: { value: "Free Size" },
    });
    fireEvent.change(screen.getByLabelText("Colour for Mayil Saree"), {
      target: { value: "Teal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Checkout now" }));
    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in", exact: true }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/checkout" }));
    expect(usePrototype.getState().bag).toHaveLength(1);
  });

  it("keeps the cart checkout action available while pricing is loading", async () => {
    usePrototype.getState().addToBag("product-id", "Free Size", "Teal");
    vi.spyOn(api, "get").mockResolvedValue({
      products: [
        {
          _id: "product-id",
          slug: "mayil-saree",
          name: "Mayil Saree",
          category: "saree",
          subCategory: "Silk",
          fabric: "Silk",
          colors: ["Teal"],
          sizes: ["Free Size"],
          price: 720,
          mrp: 1000,
          images: ["/uploads/mayil.webp"],
          inStock: true,
          lowStock: null,
          sizeStock: { "Free Size": { inStock: true, lowStock: null } },
          isActive: true,
        },
      ],
      total: 1,
    } as never);
    vi.spyOn(api, "post").mockResolvedValue({
      items: [],
      subtotal: 720,
      discount: 0,
      shipping: 0,
      total: 720,
    } as never);
    const onCheckout = vi.fn();
    render(
      <TrunkDialog
        mode="bag"
        onClose={() => undefined}
        onSelect={() => undefined}
        onCheckout={onCheckout}
      />,
    );

    const checkout = await screen.findByRole("button", { name: "Checkout" });
    expect(checkout).toBeEnabled();
    fireEvent.click(checkout);
    expect(onCheckout).toHaveBeenCalledOnce();
  });

  it("shows low stock without exposing quantities above the threshold", () => {
    render(
      <ProductCard
        product={{ ...product, sizeStock: { "Free Size": { inStock: true, lowStock: 5 } } }}
        onSelect={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("Size for Mayil Saree"), {
      target: { value: "Free Size" },
    });
    expect(screen.getByText("Only 5 left")).toBeInTheDocument();
  });

  it("disables purchase when the selected size is out of stock", () => {
    render(
      <ProductCard
        product={{ ...product, sizeStock: { "Free Size": { inStock: false, lowStock: null } } }}
        onSelect={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("Size for Mayil Saree"), {
      target: { value: "Free Size" },
    });
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to bag" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Checkout now" })).toBeDisabled();
  });

  it("shows the new-arrivals empty state when the API has no products", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ products: [] } as never);
    const router = testRouter(() => <NewArrivalsPage />);
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("New styles are coming soon.")).toBeInTheDocument();
  });

  it("shows API arrivals and discounts without exposing coupon codes", async () => {
    const arrivals: ApiProduct[] = [
      {
        _id: "discounted-product",
        slug: "mayil-saree",
        name: "Mayil Saree",
        category: "saree",
        subCategory: "Silk",
        fabric: "Silk",
        colors: ["Teal"],
        sizes: ["Free Size"],
        price: 720,
        mrp: 1000,
        originalPrice: 1000,
        offerEndsAt: new Date(Date.now() + 60_000).toISOString(),
        images: [{ url: "/uploads/mayil.webp", isPrimary: true }],
        inStock: true,
        lowStock: 4,
        sizeStock: { "Free Size": { inStock: true, lowStock: 4 } },
        isActive: true,
      },
    ];
    vi.spyOn(api, "get").mockResolvedValue({ products: arrivals } as never);
    const router = testRouter(() => <FloatingDiscovery />);
    render(<RouterProvider router={router} />);

    fireEvent.click(await screen.findByRole("button", { name: /Mayil Saree/ }));
    await waitFor(() => expect(screen.getByText("New styles & active offers")).toBeInTheDocument());
    expect(screen.getByText("28% OFF")).toBeInTheDocument();
    expect(screen.queryByText(/coupon|code/i)).not.toBeInTheDocument();
  });

  it("adds New Arrivals products to the bag and opens the drawer", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      products: [
        {
          _id: product.id,
          slug: product.slug,
          name: product.name,
          category: "saree",
          subCategory: "Silk",
          fabric: "Silk",
          colors: ["Teal"],
          sizes: ["Free Size"],
          price: 720,
          mrp: 1000,
          images: ["/uploads/mayil.webp"],
          inStock: true,
          lowStock: null,
          sizeStock: { "Free Size": { inStock: true, lowStock: null } },
          isActive: true,
        },
      ],
      total: 1,
    } as never);
    vi.spyOn(api, "post").mockResolvedValue({
      items: [],
      subtotal: 720,
      discount: 0,
      shipping: 0,
      total: 720,
    } as never);
    const router = testRouter(() => <NewArrivalsPage />);
    render(<RouterProvider router={router} />);

    fireEvent.change(await screen.findByLabelText("Size for Mayil Saree"), {
      target: { value: "Free Size" },
    });
    fireEvent.change(screen.getByLabelText("Colour for Mayil Saree"), {
      target: { value: "Teal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to bag" }));
    expect(await screen.findByText(/Your bag/)).toBeInTheDocument();
    expect(screen.getByText("Mayil Saree was added to your bag.")).toBeInTheDocument();
  });
});
