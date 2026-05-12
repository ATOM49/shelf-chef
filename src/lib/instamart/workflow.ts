import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { McpHttpError } from "@/src/lib/mcp/invoke";

export const INSTAMART_PROVIDER_KEY = "swiggy-instamart";
const MAX_DRAFT_CART_ITEMS = 10;
const TRACKING_POLL_INTERVAL_MS = 10_000;

export type InstamartCartLine = {
  spinId: string;
  quantity: number;
};

export type InstamartWorkflowStatus =
  | "in_progress"
  | "awaiting_approval"
  | "completed"
  | "cancelled"
  | "failed";

export type InstamartCheckoutStatus = {
  requestedAt: string | null;
  completedAt: string | null;
  orderId: string | null;
  usedPaymentMethod: string | null;
  ambiguousFailureRecovered: boolean;
  lastError: string | null;
};

export type InstamartTrackingStatus = {
  orderId: string | null;
  snapshot: unknown | null;
  lastPolledAt: string | null;
  nextPollAfter: string | null;
};

export type InstamartWorkflowState = {
  sessionId: string;
  userId: string;
  status: InstamartWorkflowStatus;
  stage:
    | "resolve_address"
    | "discover_items"
    | "build_draft_cart"
    | "apply_cart"
    | "refresh_cart"
    | "awaiting_approval"
    | "checkout"
    | "track_order"
    | "summary"
    | "completed"
    | "cancelled"
    | "failed";
  requestedAddressId: string | null;
  selectedAddressId: string | null;
  previousAddressIdWithCart: string | null;
  discoveryQuery: string | null;
  useGoToItems: boolean;
  discoveredProducts: unknown[];
  draftCartPlan: InstamartCartLine[];
  serverCartSnapshot: unknown | null;
  availablePaymentMethods: string[];
  approvalRequired: boolean;
  approved: boolean;
  requestedPaymentMethod: string | null;
  checkout: InstamartCheckoutStatus;
  tracking: InstamartTrackingStatus;
  summary: string[];
  updatedAt: string;
};

export type StartInstamartInput = {
  sessionId: string;
  userId: string;
  selectedAddressId?: string;
  query?: string;
  useGoToItems?: boolean;
  draftItems?: InstamartCartLine[];
  previousAddressIdWithCart?: string | null;
};

export type ResumeInstamartInput = {
  paymentMethod?: string;
  approved: boolean;
};

type InstamartToolCaller = (toolName: string, toolArgs?: Record<string, unknown>) => Promise<unknown>;

type StartWorkflowState = {
  requestedAddressId: string | null;
  selectedAddressId: string | null;
  previousAddressIdWithCart: string | null;
  discoveryQuery: string | null;
  useGoToItems: boolean;
  discoveredProducts: unknown[];
  providedDraftItems: InstamartCartLine[];
  draftCartPlan: InstamartCartLine[];
  serverCartSnapshot: unknown | null;
  availablePaymentMethods: string[];
  summary: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeCartLines(lines: InstamartCartLine[] | undefined): InstamartCartLine[] {
  if (!Array.isArray(lines)) return [];

  const merged = new Map<string, number>();
  for (const line of lines) {
    const spinId = line.spinId?.trim();
    const quantity = Number.isFinite(line.quantity) ? Math.floor(line.quantity) : 0;
    if (!spinId || quantity <= 0) continue;
    merged.set(spinId, (merged.get(spinId) ?? 0) + quantity);
  }

  return Array.from(merged.entries()).map(([spinId, quantity]) => ({
    spinId,
    quantity,
  }));
}

function pickListCandidate<T = Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is T => typeof item === "object" && item !== null);
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const knownKeys = [
      "addresses",
      "items",
      "products",
      "results",
      "orders",
      "data",
      "list",
    ];
    for (const key of knownKeys) {
      const candidate = pickListCandidate<T>(record[key]);
      if (candidate.length > 0) return candidate;
    }
  }
  return [];
}

function pickString(value: unknown, keys: string[]): string | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function parseAddressIds(response: unknown): string[] {
  const entries = pickListCandidate<Record<string, unknown>>(response);
  const ids = entries
    .map((entry) => pickString(entry, ["id", "addressId", "selectedAddressId"]))
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

function parseProducts(response: unknown): Record<string, unknown>[] {
  return pickListCandidate<Record<string, unknown>>(response);
}

function extractSpinIdsFromProduct(product: Record<string, unknown>): string[] {
  const variants = pickListCandidate<Record<string, unknown>>(
    product.variants ?? product.spins ?? product.options,
  );

  const variantSpinIds = variants
    .map((variant) => pickString(variant, ["spinId", "id", "variantId"]))
    .filter((spinId): spinId is string => Boolean(spinId));

  if (variantSpinIds.length > 0) {
    return variantSpinIds;
  }

  const rootSpinId = pickString(product, ["spinId"]);
  return rootSpinId ? [rootSpinId] : [];
}

export function buildDraftCartFromProducts(products: Record<string, unknown>[]): InstamartCartLine[] {
  const lines: InstamartCartLine[] = [];
  for (const product of products) {
    for (const spinId of extractSpinIdsFromProduct(product)) {
      lines.push({ spinId, quantity: 1 });
      if (lines.length >= MAX_DRAFT_CART_ITEMS) {
        return normalizeCartLines(lines);
      }
    }
  }
  return normalizeCartLines(lines);
}

function parseAvailablePaymentMethods(cartResponse: unknown): string[] {
  const cart = typeof cartResponse === "object" && cartResponse !== null
    ? (cartResponse as Record<string, unknown>)
    : {};
  const methods = pickListCandidate<Record<string, unknown>>(
    cart.availablePaymentMethods ?? cart.paymentMethods,
  );
  const names = methods
    .map((method) => pickString(method, ["id", "name", "method"]))
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names));
}

function parseOrderId(response: unknown): string | null {
  if (typeof response === "object" && response !== null) {
    const record = response as Record<string, unknown>;
    const direct = pickString(record, ["orderId", "id"]);
    if (direct) return direct;
    const nestedOrders = pickListCandidate<Record<string, unknown>>(record.orders);
    for (const order of nestedOrders) {
      const id = pickString(order, ["orderId", "id"]);
      if (id) return id;
    }
  }
  return null;
}

function isAmbiguousCheckoutError(error: unknown): boolean {
  if (error instanceof McpHttpError && error.status >= 500) {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("network") || message.includes("timeout") || message.includes("http 5");
}

function parseOrders(response: unknown): string[] {
  const orders = pickListCandidate<Record<string, unknown>>(response);
  const ids = orders
    .map((order) => pickString(order, ["orderId", "id"]))
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

export function shouldClearCartOnAddressChange(
  previousAddressId: string | null | undefined,
  nextAddressId: string | null | undefined,
): boolean {
  if (!previousAddressId || !nextAddressId) return false;
  return previousAddressId.trim() !== nextAddressId.trim();
}

async function resolveAddressNode(state: StartWorkflowState, callTool: InstamartToolCaller) {
  const addressesResponse = await callTool("get_addresses");
  const addressIds = parseAddressIds(addressesResponse);
  const selectedAddressId = state.requestedAddressId ?? addressIds[0] ?? null;

  if (!selectedAddressId) {
    throw new Error("No address available for Instamart checkout.");
  }

  if (state.requestedAddressId && !addressIds.includes(state.requestedAddressId)) {
    throw new Error("Requested address is not available in Swiggy addresses.");
  }

  if (shouldClearCartOnAddressChange(state.previousAddressIdWithCart, selectedAddressId)) {
    await callTool("update_cart", {
      selectedAddressId: state.previousAddressIdWithCart,
      items: [],
    });
  }

  return {
    selectedAddressId,
    summary: [
      ...state.summary,
      `Resolved delivery address: ${selectedAddressId}`,
    ],
  };
}

async function discoverItemsNode(state: StartWorkflowState, callTool: InstamartToolCaller) {
  if (state.providedDraftItems.length > 0) {
    return {
      discoveredProducts: [],
      summary: [...state.summary, "Skipped discovery because draft cart items were provided."],
    };
  }

  const toolName = state.discoveryQuery?.trim()
    ? "search_products"
    : state.useGoToItems
      ? "your_go_to_items"
      : "search_products";
  const toolArgs: Record<string, unknown> = {
    selectedAddressId: state.selectedAddressId,
  };
  if (toolName === "search_products") {
    toolArgs.query = state.discoveryQuery?.trim() || "groceries";
  }

  const response = await callTool(toolName, toolArgs);
  const products = parseProducts(response);

  return {
    discoveredProducts: products,
    summary: [...state.summary, `Discovered ${products.length} candidate products via ${toolName}.`],
  };
}

function buildDraftCartNode(state: StartWorkflowState) {
  const draft = state.providedDraftItems.length > 0
    ? normalizeCartLines(state.providedDraftItems)
    : buildDraftCartFromProducts(state.discoveredProducts);

  if (draft.length === 0) {
    throw new Error("Unable to build a cart draft from Instamart discovery results.");
  }

  return {
    draftCartPlan: draft,
    summary: [...state.summary, `Built draft cart with ${draft.length} line items.`],
  };
}

async function applyCartNode(state: StartWorkflowState, callTool: InstamartToolCaller) {
  await callTool("update_cart", {
    selectedAddressId: state.selectedAddressId,
    items: state.draftCartPlan.map((line) => ({
      spinId: line.spinId,
      quantity: line.quantity,
    })),
  });
  return {
    summary: [...state.summary, "Applied draft cart to Swiggy using update_cart."],
  };
}

async function refreshCartNode(state: StartWorkflowState, callTool: InstamartToolCaller) {
  const cartResponse = await callTool("get_cart", {
    selectedAddressId: state.selectedAddressId,
  });
  const availablePaymentMethods = parseAvailablePaymentMethods(cartResponse);
  return {
    serverCartSnapshot: cartResponse,
    availablePaymentMethods,
    summary: [
      ...state.summary,
      `Fetched authoritative cart snapshot with ${availablePaymentMethods.length} payment methods.`,
    ],
  };
}

function createStartGraph(callTool: InstamartToolCaller) {
  const StartState = Annotation.Root({
    requestedAddressId: Annotation<string | null>,
    selectedAddressId: Annotation<string | null>,
    previousAddressIdWithCart: Annotation<string | null>,
    discoveryQuery: Annotation<string | null>,
    useGoToItems: Annotation<boolean>,
    discoveredProducts: Annotation<unknown[]>({
      reducer: (_left, right) => right,
      default: () => [],
    }),
    providedDraftItems: Annotation<InstamartCartLine[]>({
      reducer: (_left, right) => right,
      default: () => [],
    }),
    draftCartPlan: Annotation<InstamartCartLine[]>({
      reducer: (_left, right) => right,
      default: () => [],
    }),
    serverCartSnapshot: Annotation<unknown | null>({
      reducer: (_left, right) => right,
      default: () => null,
    }),
    availablePaymentMethods: Annotation<string[]>({
      reducer: (_left, right) => right,
      default: () => [],
    }),
    summary: Annotation<string[]>({
      reducer: (_left, right) => right,
      default: () => [],
    }),
  });

  return new StateGraph(StartState)
    .addNode("resolve_address", (state: typeof StartState.State) => resolveAddressNode(state, callTool))
    .addNode("discover_items", (state: typeof StartState.State) => discoverItemsNode(state, callTool))
    .addNode("build_draft_cart", (state: typeof StartState.State) => buildDraftCartNode(state))
    .addNode("apply_cart", (state: typeof StartState.State) => applyCartNode(state, callTool))
    .addNode("refresh_cart", (state: typeof StartState.State) => refreshCartNode(state, callTool))
    .addEdge(START, "resolve_address")
    .addEdge("resolve_address", "discover_items")
    .addEdge("discover_items", "build_draft_cart")
    .addEdge("build_draft_cart", "apply_cart")
    .addEdge("apply_cart", "refresh_cart")
    .addEdge("refresh_cart", END)
    .compile();
}

export async function startInstamartWorkflow(
  input: StartInstamartInput,
  callTool: InstamartToolCaller,
): Promise<InstamartWorkflowState> {
  const graph = createStartGraph(callTool);
  const result = await graph.invoke({
    requestedAddressId: input.selectedAddressId ?? null,
    selectedAddressId: null,
    previousAddressIdWithCart: input.previousAddressIdWithCart ?? null,
    discoveryQuery: input.query?.trim() || null,
    useGoToItems: input.useGoToItems ?? false,
    discoveredProducts: [],
    providedDraftItems: normalizeCartLines(input.draftItems),
    draftCartPlan: [],
    serverCartSnapshot: null,
    availablePaymentMethods: [],
    summary: [],
  });

  if (!result.selectedAddressId) {
    throw new Error("Instamart workflow did not resolve an address.");
  }

  return {
    sessionId: input.sessionId,
    userId: input.userId,
    status: "awaiting_approval",
    stage: "awaiting_approval",
    requestedAddressId: input.selectedAddressId ?? null,
    selectedAddressId: result.selectedAddressId,
    previousAddressIdWithCart: result.selectedAddressId,
    discoveryQuery: input.query?.trim() || null,
    useGoToItems: input.useGoToItems ?? false,
    discoveredProducts: result.discoveredProducts,
    draftCartPlan: result.draftCartPlan,
    serverCartSnapshot: result.serverCartSnapshot,
    availablePaymentMethods: result.availablePaymentMethods,
    approvalRequired: true,
    approved: false,
    requestedPaymentMethod: null,
    checkout: {
      requestedAt: null,
      completedAt: null,
      orderId: null,
      usedPaymentMethod: null,
      ambiguousFailureRecovered: false,
      lastError: null,
    },
    tracking: {
      orderId: null,
      snapshot: null,
      lastPolledAt: null,
      nextPollAfter: null,
    },
    summary: [...result.summary, "Workflow paused for explicit user approval before checkout."],
    updatedAt: nowIso(),
  };
}

async function refreshCartBeforeCheckout(
  state: InstamartWorkflowState,
  callTool: InstamartToolCaller,
): Promise<Partial<InstamartWorkflowState>> {
  const cartResponse = await callTool("get_cart", {
    selectedAddressId: state.selectedAddressId,
  });
  const availablePaymentMethods = parseAvailablePaymentMethods(cartResponse);
  if (
    state.requestedPaymentMethod
    && availablePaymentMethods.length > 0
    && !availablePaymentMethods.includes(state.requestedPaymentMethod)
  ) {
    throw new Error(
      `Requested payment method "${state.requestedPaymentMethod}" is not available for checkout.`,
    );
  }

  return {
    serverCartSnapshot: cartResponse,
    availablePaymentMethods,
    summary: [
      ...state.summary,
      "Refreshed cart immediately before checkout to enforce server-authoritative state.",
    ],
  };
}

async function performCheckoutWithGuard(
  state: InstamartWorkflowState,
  callTool: InstamartToolCaller,
): Promise<Partial<InstamartWorkflowState>> {
  const requestedAt = nowIso();
  const checkoutArgs: Record<string, unknown> = {
    addressId: state.selectedAddressId,
  };
  if (state.requestedPaymentMethod) {
    checkoutArgs.paymentMethod = state.requestedPaymentMethod;
  }

  const successfulCheckout = async () => {
    const response = await callTool("checkout", checkoutArgs);
    const orderId = parseOrderId(response);
    return {
      response,
      orderId,
      ambiguousFailureRecovered: false,
    };
  };

  try {
    const checkout = await successfulCheckout();
    return {
      checkout: {
        requestedAt,
        completedAt: nowIso(),
        orderId: checkout.orderId,
        usedPaymentMethod: state.requestedPaymentMethod,
        ambiguousFailureRecovered: checkout.ambiguousFailureRecovered,
        lastError: null,
      },
      summary: [...state.summary, "Checkout completed successfully."],
    };
  } catch (error) {
    if (!isAmbiguousCheckoutError(error)) {
      throw error;
    }

    const ordersResponse = await callTool("get_orders", {
      selectedAddressId: state.selectedAddressId,
    });
    const knownOrderIds = parseOrders(ordersResponse);
    if (knownOrderIds.length > 0) {
      return {
        checkout: {
          requestedAt,
          completedAt: nowIso(),
          orderId: knownOrderIds[0] ?? null,
          usedPaymentMethod: state.requestedPaymentMethod,
          ambiguousFailureRecovered: true,
          lastError: null,
        },
        summary: [
          ...state.summary,
          "Checkout response was ambiguous; recovered by confirming order via get_orders.",
        ],
      };
    }

    const retry = await successfulCheckout();
    return {
      checkout: {
        requestedAt,
        completedAt: nowIso(),
        orderId: retry.orderId,
        usedPaymentMethod: state.requestedPaymentMethod,
        ambiguousFailureRecovered: false,
        lastError: null,
      },
      summary: [
        ...state.summary,
        "Checkout response was ambiguous; no existing order found, retry succeeded safely.",
      ],
    };
  }
}

async function trackOrderNode(
  state: InstamartWorkflowState,
  callTool: InstamartToolCaller,
): Promise<Partial<InstamartWorkflowState>> {
  if (!state.checkout.orderId) {
    return {
      summary: [...state.summary, "Checkout did not return an order ID; tracking skipped."],
      tracking: state.tracking,
    };
  }

  const trackedAt = new Date();
  const trackingSnapshot = await callTool("track_order", {
    orderId: state.checkout.orderId,
  });
  const nextPollAfter = new Date(trackedAt.getTime() + TRACKING_POLL_INTERVAL_MS).toISOString();

  return {
    tracking: {
      orderId: state.checkout.orderId,
      snapshot: trackingSnapshot,
      lastPolledAt: trackedAt.toISOString(),
      nextPollAfter,
    },
    summary: [
      ...state.summary,
      "Tracked order once after checkout. Next poll should not occur before 10 seconds.",
    ],
  };
}

const ResumeState = Annotation.Root({
  workflow: Annotation<InstamartWorkflowState>({
    reducer: (_left, right) => right,
  }),
});

function createResumeGraph(callTool: InstamartToolCaller) {
  return new StateGraph(ResumeState)
    .addNode("refresh_cart", async (state: typeof ResumeState.State) => ({
      workflow: {
        ...state.workflow,
        stage: "refresh_cart",
        ...(await refreshCartBeforeCheckout(state.workflow, callTool)),
      },
    }))
    .addNode("checkout", async (state: typeof ResumeState.State) => ({
      workflow: {
        ...state.workflow,
        stage: "checkout",
        ...(await performCheckoutWithGuard(state.workflow, callTool)),
      },
    }))
    .addNode("track_order", async (state: typeof ResumeState.State) => ({
      workflow: {
        ...state.workflow,
        stage: "track_order",
        ...(await trackOrderNode(state.workflow, callTool)),
      },
    }))
    .addNode("summary", (state: typeof ResumeState.State) => ({
      workflow: {
        ...state.workflow,
        stage: "completed",
        status: "completed",
        updatedAt: nowIso(),
        summary: [...state.workflow.summary, "Instamart workflow completed."],
      },
    }))
    .addEdge(START, "refresh_cart")
    .addEdge("refresh_cart", "checkout")
    .addEdge("checkout", "track_order")
    .addEdge("track_order", "summary")
    .addEdge("summary", END)
    .compile();
}

export async function resumeInstamartWorkflow(
  currentState: InstamartWorkflowState,
  input: ResumeInstamartInput,
  callTool: InstamartToolCaller,
): Promise<InstamartWorkflowState> {
  if (currentState.status !== "awaiting_approval") {
    throw new Error("Workflow is not awaiting approval and cannot be resumed.");
  }

  if (!input.approved) {
    return {
      ...currentState,
      approved: false,
      status: "cancelled",
      stage: "cancelled",
      updatedAt: nowIso(),
      summary: [...currentState.summary, "Workflow cancelled because user declined checkout approval."],
    };
  }

  const preparedState: InstamartWorkflowState = {
    ...currentState,
    approved: true,
    requestedPaymentMethod: input.paymentMethod?.trim() || null,
    stage: "checkout",
    status: "in_progress",
    updatedAt: nowIso(),
  };

  const graph = createResumeGraph(callTool);
  const result = await graph.invoke({
    workflow: preparedState,
  });

  return {
    ...result.workflow,
    updatedAt: nowIso(),
  };
}
