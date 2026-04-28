/**
 * Notion sync orchestrator.
 *
 * Syncs the user's weekly plan and grocery cart to Notion using the hosted
 * Notion MCP server.  The flow is:
 *
 *  1. Ensure a dedicated parent page ("Kitchen Planner") exists.
 *  2. Ensure the Weekly Plan database exists under that page.
 *  3. Ensure the Shopping Cart database exists under that page.
 *  4. Upsert meal rows into the Weekly Plan database.
 *  5. Upsert grocery cart rows into the Shopping Cart database.
 *
 * Existing Notion assets are reused via NotionWorkspaceMapping stored in the
 * database to prevent duplicate pages/databases on re-sync.
 *
 * Rows are matched by their internal "App Meal ID" / "App Item ID" property so
 * that re-syncing updates existing rows instead of creating new ones.
 */

import { prisma } from "@/lib/db";
import type { PlannedMeal, GroceryCartItem } from "@/lib/planner/types";
import {
  createPage,
  createDatabase,
  createDatabaseRow,
  updateDatabaseRow,
  queryDatabase,
} from "./client";
import {
  KITCHEN_PLANNER_PAGE_TITLE,
  WEEKLY_PLAN_DB_TITLE,
  WEEKLY_PLAN_PROPERTIES,
  SHOPPING_CART_DB_TITLE,
  SHOPPING_CART_PROPERTIES,
} from "./schema";
import {
  plannedMealToRowProperties,
  groceryItemToRowProperties,
  extractAppMealId,
  extractAppItemId,
} from "./mappings";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type NotionSyncResult = {
  parentPageId: string;
  weeklyPlanDatabaseId: string;
  shoppingCartDatabaseId: string;
  mealsUpserted: number;
  cartItemsUpserted: number;
};

/**
 * Syncs the user's current weekly plan and grocery cart to Notion.
 *
 * @param userId  - Authenticated user performing the sync.
 * @param meals   - Current weekly plan meals.
 * @param cartItems - Current grocery cart items.
 */
export async function syncToNotion(
  userId: string,
  meals: PlannedMeal[],
  cartItems: GroceryCartItem[],
): Promise<NotionSyncResult> {
  // --- Step 1: Ensure parent page ---
  const parentPageId = await ensureParentPage(userId);

  // --- Step 2 & 3: Ensure databases ---
  const [weeklyPlanDatabaseId, shoppingCartDatabaseId] = await Promise.all([
    ensureWeeklyPlanDatabase(userId, parentPageId),
    ensureShoppingCartDatabase(userId, parentPageId),
  ]);

  // --- Step 4: Upsert meal rows ---
  const mealsUpserted = await upsertMealRows(userId, weeklyPlanDatabaseId, meals);

  // --- Step 5: Upsert cart rows ---
  const cartItemsUpserted = await upsertCartRows(userId, shoppingCartDatabaseId, cartItems);

  return {
    parentPageId,
    weeklyPlanDatabaseId,
    shoppingCartDatabaseId,
    mealsUpserted,
    cartItemsUpserted,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Returns the parent page ID, creating one if none is mapped yet. */
async function ensureParentPage(userId: string): Promise<string> {
  const mapping = await prisma.notionWorkspaceMapping.findUnique({ where: { userId } });

  if (mapping?.parentPageId) {
    return mapping.parentPageId;
  }

  const page = await createPage(userId, { title: KITCHEN_PLANNER_PAGE_TITLE });
  await prisma.notionWorkspaceMapping.upsert({
    where: { userId },
    update: { parentPageId: page.id },
    create: { userId, parentPageId: page.id },
  });

  return page.id;
}

/** Returns the Weekly Plan database ID, creating it if none is mapped yet. */
async function ensureWeeklyPlanDatabase(
  userId: string,
  parentPageId: string,
): Promise<string> {
  const mapping = await prisma.notionWorkspaceMapping.findUnique({ where: { userId } });

  if (mapping?.weeklyPlanDatabaseId) {
    return mapping.weeklyPlanDatabaseId;
  }

  const db = await createDatabase(userId, {
    parentPageId,
    title: WEEKLY_PLAN_DB_TITLE,
    properties: WEEKLY_PLAN_PROPERTIES,
  });

  await prisma.notionWorkspaceMapping.update({
    where: { userId },
    data: { weeklyPlanDatabaseId: db.id },
  });

  return db.id;
}

/** Returns the Shopping Cart database ID, creating it if none is mapped yet. */
async function ensureShoppingCartDatabase(
  userId: string,
  parentPageId: string,
): Promise<string> {
  const mapping = await prisma.notionWorkspaceMapping.findUnique({ where: { userId } });

  if (mapping?.shoppingCartDatabaseId) {
    return mapping.shoppingCartDatabaseId;
  }

  const db = await createDatabase(userId, {
    parentPageId,
    title: SHOPPING_CART_DB_TITLE,
    properties: SHOPPING_CART_PROPERTIES,
  });

  await prisma.notionWorkspaceMapping.update({
    where: { userId },
    data: { shoppingCartDatabaseId: db.id },
  });

  return db.id;
}

/**
 * Upserts planned meal rows into the Weekly Plan database.
 *
 * Existing rows are matched by the "App Meal ID" property.  Matched rows are
 * updated; unmatched rows are created.
 */
async function upsertMealRows(
  userId: string,
  databaseId: string,
  meals: PlannedMeal[],
): Promise<number> {
  if (meals.length === 0) return 0;

  // Fetch all existing rows to build an ID → pageId map
  const existing = await queryDatabase(userId, databaseId);
  const existingByMealId = new Map<string, string>();
  for (const row of existing.results) {
    const mealId = extractAppMealId(row.properties);
    if (mealId) {
      existingByMealId.set(mealId, row.id);
    }
  }

  let upserted = 0;
  await Promise.all(
    meals.map(async (meal) => {
      const properties = plannedMealToRowProperties(meal);
      const existingPageId = existingByMealId.get(meal.id);

      if (existingPageId) {
        await updateDatabaseRow(userId, existingPageId, properties);
      } else {
        await createDatabaseRow(userId, databaseId, properties);
      }
      upserted++;
    }),
  );

  return upserted;
}

/**
 * Upserts grocery cart rows into the Shopping Cart database.
 *
 * Existing rows are matched by the "App Item ID" property.
 */
async function upsertCartRows(
  userId: string,
  databaseId: string,
  cartItems: GroceryCartItem[],
): Promise<number> {
  if (cartItems.length === 0) return 0;

  const existing = await queryDatabase(userId, databaseId);
  const existingByItemId = new Map<string, string>();
  for (const row of existing.results) {
    const itemId = extractAppItemId(row.properties);
    if (itemId) {
      existingByItemId.set(itemId, row.id);
    }
  }

  let upserted = 0;
  await Promise.all(
    cartItems.map(async (item) => {
      const properties = groceryItemToRowProperties(item);
      const existingPageId = existingByItemId.get(item.id);

      if (existingPageId) {
        await updateDatabaseRow(userId, existingPageId, properties);
      } else {
        await createDatabaseRow(userId, databaseId, properties);
      }
      upserted++;
    }),
  );

  return upserted;
}
