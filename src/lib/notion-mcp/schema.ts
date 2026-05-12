/**
 * Notion database property schema definitions.
 *
 * These describe the property columns for the two databases the app manages
 * inside Notion:
 *  - Weekly Plan database
 *  - Shopping Cart database
 *
 * Property schemas follow the Notion API format for database creation.
 */

import type { DatabaseProperty } from "./client";

// ---------------------------------------------------------------------------
// Weekly Plan database
// ---------------------------------------------------------------------------

export const WEEKLY_PLAN_DB_TITLE = "Weekly Plan";

export const WEEKLY_PLAN_PROPERTIES: Record<string, DatabaseProperty> = {
  // Primary name column (required title property)
  Name: { type: "title", title: {} },
  // Day of the week
  Day: {
    type: "select",
    select: {
      options: [
        { name: "Monday", color: "blue" },
        { name: "Tuesday", color: "green" },
        { name: "Wednesday", color: "yellow" },
        { name: "Thursday", color: "orange" },
        { name: "Friday", color: "red" },
        { name: "Saturday", color: "purple" },
        { name: "Sunday", color: "pink" },
      ],
    },
  },
  // Meal type
  "Meal Type": {
    type: "select",
    select: {
      options: [
        { name: "Breakfast", color: "yellow" },
        { name: "Lunch", color: "green" },
        { name: "Dinner", color: "blue" },
      ],
    },
  },
  // Cooking status
  Status: {
    type: "select",
    select: {
      options: [
        { name: "Planned", color: "gray" },
        { name: "Completed", color: "green" },
      ],
    },
  },
  // Can the meal be cooked with current inventory?
  "Can Cook": { type: "checkbox", checkbox: {} },
  // Recipe reference URL
  "Recipe URL": { type: "url", url: {} },
  // Summary of missing ingredients
  "Missing Ingredients": { type: "rich_text", rich_text: {} },
  // Internal sync key for idempotent updates
  "App Meal ID": { type: "rich_text", rich_text: {} },
  // Last sync timestamp
  "Synced At": { type: "date", date: {} },
};

// ---------------------------------------------------------------------------
// Shopping Cart database
// ---------------------------------------------------------------------------

export const SHOPPING_CART_DB_TITLE = "Shopping Cart";

export const SHOPPING_CART_PROPERTIES: Record<string, DatabaseProperty> = {
  // Primary name column
  Item: { type: "title", title: {} },
  // Quantity needed (stored as a number)
  "Quantity Needed": { type: "number", number: { format: "number" } },
  // Unit as a plain-text field
  Unit: { type: "rich_text", rich_text: {} },
  // Why this item is on the list
  Reason: {
    type: "select",
    select: {
      options: [
        { name: "Missing", color: "red" },
        { name: "Low", color: "yellow" },
      ],
    },
  },
  // Which meals need this item
  "Linked Meals": { type: "rich_text", rich_text: {} },
  // Whether the item has been purchased
  Purchased: { type: "checkbox", checkbox: {} },
  // Internal sync key for idempotent updates
  "App Item ID": { type: "rich_text", rich_text: {} },
  // Last sync timestamp
  "Synced At": { type: "date", date: {} },
};

// ---------------------------------------------------------------------------
// Parent page
// ---------------------------------------------------------------------------

export const KITCHEN_PLANNER_PAGE_TITLE = "Kitchen Planner";
