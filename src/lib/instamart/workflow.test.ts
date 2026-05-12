import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDraftCartFromProducts,
  resumeInstamartWorkflow,
  shouldClearCartOnAddressChange,
  startInstamartWorkflow,
  type InstamartWorkflowState,
} from "@/src/lib/instamart/workflow";

test("buildDraftCartFromProducts prefers variant spin IDs", () => {
  const lines = buildDraftCartFromProducts([
    {
      id: "p1",
      variants: [{ spinId: "spin-a" }, { spinId: "spin-b" }],
    },
  ]);
  assert.deepEqual(lines, [
    { spinId: "spin-a", quantity: 1 },
    { spinId: "spin-b", quantity: 1 },
  ]);
});

test("shouldClearCartOnAddressChange detects cross-address cart flow", () => {
  assert.equal(shouldClearCartOnAddressChange("address-1", "address-2"), true);
  assert.equal(shouldClearCartOnAddressChange("address-1", "address-1"), false);
});

test("startInstamartWorkflow pauses after refresh_cart awaiting approval", async () => {
  const calls: Array<{ tool: string; args?: Record<string, unknown> }> = [];

  const state = await startInstamartWorkflow(
    {
      sessionId: "session-1",
      userId: "user-1",
      selectedAddressId: "address-1",
      draftItems: [{ spinId: "spin-1", quantity: 2 }],
    },
    async (toolName, toolArgs) => {
      calls.push({ tool: toolName, args: toolArgs });
      switch (toolName) {
        case "get_addresses":
          return [{ id: "address-1" }];
        case "update_cart":
          return { ok: true };
        case "get_cart":
          return { availablePaymentMethods: [{ id: "upi" }] };
        default:
          return [];
      }
    },
  );

  assert.equal(state.status, "awaiting_approval");
  assert.equal(state.stage, "awaiting_approval");
  assert.equal(state.selectedAddressId, "address-1");
  assert.deepEqual(
    calls.map((call) => call.tool),
    ["get_addresses", "update_cart", "get_cart"],
  );
});

test("resumeInstamartWorkflow cancels when user declines approval", async () => {
  const current: InstamartWorkflowState = {
    sessionId: "session-1",
    userId: "user-1",
    status: "awaiting_approval",
    stage: "awaiting_approval",
    requestedAddressId: "address-1",
    selectedAddressId: "address-1",
    previousAddressIdWithCart: "address-1",
    discoveryQuery: null,
    useGoToItems: false,
    discoveredProducts: [],
    draftCartPlan: [{ spinId: "spin-1", quantity: 1 }],
    serverCartSnapshot: null,
    availablePaymentMethods: ["upi"],
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
    summary: [],
    updatedAt: new Date().toISOString(),
  };

  const resumed = await resumeInstamartWorkflow(
    current,
    { approved: false },
    async () => ({}),
  );

  assert.equal(resumed.status, "cancelled");
  assert.equal(resumed.stage, "cancelled");
});

test("resumeInstamartWorkflow validates available payment methods on checkout refresh", async () => {
  const current: InstamartWorkflowState = {
    sessionId: "session-1",
    userId: "user-1",
    status: "awaiting_approval",
    stage: "awaiting_approval",
    requestedAddressId: "address-1",
    selectedAddressId: "address-1",
    previousAddressIdWithCart: "address-1",
    discoveryQuery: null,
    useGoToItems: false,
    discoveredProducts: [],
    draftCartPlan: [{ spinId: "spin-1", quantity: 1 }],
    serverCartSnapshot: null,
    availablePaymentMethods: ["upi"],
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
    summary: [],
    updatedAt: new Date().toISOString(),
  };

  await assert.rejects(
    () =>
      resumeInstamartWorkflow(
        current,
        { approved: true, paymentMethod: "cash" },
        async (toolName) => {
          if (toolName === "get_cart") {
            return { availablePaymentMethods: [{ id: "upi" }] };
          }
          return {};
        },
      ),
    /not available for checkout/i,
  );
});

