/**
 * Swiggy Instamart MCP client.
 *
 * Thin wrappers around invokeMcpTool that call Instamart-specific tools on
 * the hosted Swiggy MCP server. Tool names and parameter shapes follow the
 * published reference docs — the response `data` payload shape is NOT
 * published there (each tool's example only shows the generic
 * `{ success, data, message }` / `{ success, error }` envelope), so callers
 * must treat `data` as opaque and not assume specific fields exist.
 *
 * Reference: https://mcp.swiggy.com/builders/docs/reference/instamart/
 */

import { invokeMcpTool } from "@/src/lib/mcp/invoke";
import { getEnabledMcpProvider } from "@/src/lib/mcp/providers";

const PROVIDER_KEY = "swiggy-instamart-mcp";

async function getInstamartMcpServerUrl(userId: string): Promise<string> {
  const provider = await getEnabledMcpProvider(PROVIDER_KEY, userId);
  if (!provider) {
    throw new Error("swiggy-instamart-mcp provider is not enabled.");
  }
  return provider.mcpServerUrl;
}

async function invoke<T = unknown>(
  userId: string,
  toolName: string,
  toolArgs?: Record<string, unknown>,
): Promise<InstamartToolResult<T>> {
  const result = await invokeMcpTool({
    userId,
    providerKey: PROVIDER_KEY,
    mcpServerUrl: await getInstamartMcpServerUrl(userId),
    toolName,
    toolArgs,
  });
  return result as InstamartToolResult<T>;
}

/** Generic envelope every Instamart tool call returns. `data`'s shape is tool-specific and undocumented. */
export type InstamartToolResult<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: { message: string };
};

// ---------------------------------------------------------------------------
// Address tools
// ---------------------------------------------------------------------------

/** Fetch the user's saved Instamart delivery addresses. */
export function getAddresses(userId: string) {
  return invoke(userId, "get_addresses");
}

/** Create a new delivery address, used when the user has none saved yet. */
export function createAddress(userId: string, args: Record<string, unknown>) {
  return invoke(userId, "create_address", args);
}

// ---------------------------------------------------------------------------
// Discovery & cart tools
// ---------------------------------------------------------------------------

/** Search for products at a delivery address. Returns variants — the docs require asking the user which variant to add before adding to cart. */
export function searchProducts(
  userId: string,
  args: { addressId: string; query: string; offset?: number },
) {
  return invoke(userId, "search_products", args);
}

/** Add/update items in the Instamart cart by spinId (variant identifier). */
export function updateCart(
  userId: string,
  args: {
    selectedAddressId: string;
    items: Array<{ spinId: string; quantity: number }>;
  },
) {
  return invoke(userId, "update_cart", args);
}

/** Read the current Instamart cart, including bill breakdown and available payment methods. */
export function getCart(userId: string) {
  return invoke(userId, "get_cart");
}

/** Empty the Instamart cart. Recommended before switching delivery address. */
export function clearCart(userId: string) {
  return invoke(userId, "clear_cart");
}

// ---------------------------------------------------------------------------
// Order tools
// ---------------------------------------------------------------------------

/**
 * Place the order for the current Instamart cart.
 *
 * Per the Swiggy docs, this must only be called after the caller has shown
 * the user the full cart (via `getCart`), the delivery address, and the
 * available payment methods, and has received explicit confirmation.
 */
export function checkout(
  userId: string,
  args: { addressId: string; paymentMethod?: string },
) {
  return invoke(userId, "checkout", args);
}

/** Fetch past Instamart order history. */
export function getOrders(userId: string) {
  return invoke(userId, "get_orders");
}

/** Track delivery status of a specific order. */
export function trackOrder(userId: string, args: { orderId: string }) {
  return invoke(userId, "track_order", args);
}
