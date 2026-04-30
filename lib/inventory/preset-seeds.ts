import type { StockReviewItem } from "@/lib/stocking/types";
import type { PresetId } from "@/lib/inventory/presets";

/**
 * Pre-generated seed inventory items for each preset.
 *
 * These items are served directly by the /api/stock/preset endpoint so that
 * new users can stock their shelves immediately without waiting for an LLM
 * call. Run `npm run generate:preset-seeds` to regenerate this file using the
 * actual LLM API.
 */
export const PRESET_SEEDS: Record<PresetId, StockReviewItem[]> = {
  scarce: [
    // Fridge – bare essentials
    { emoji: "🥚", name: "Eggs", quantity: 6, unit: "count", category: "protein", storageType: "fridge", shelfName: "Fridge Shelf", flagged: false },
    { emoji: "🥛", name: "Milk", quantity: 500, unit: "ml", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🧅", name: "Onion", quantity: 3, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🍅", name: "Tomato", quantity: 3, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    // Pantry – bare essentials
    { emoji: "🍚", name: "Rice", quantity: 1, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🫘", name: "Toor Dal", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🫙", name: "Cooking Oil", quantity: 500, unit: "ml", category: "condiment", storageType: "pantry", shelfName: "Oils & Condiments", flagged: false },
    { emoji: "🧂", name: "Salt", quantity: 500, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌾", name: "Whole Wheat Flour", quantity: 1, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌶️", name: "Red Chilli Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🟡", name: "Turmeric Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Coriander Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
  ],

  "fridge-heavy": [
    // Fridge – proteins & dairy
    { emoji: "🥚", name: "Eggs", quantity: 12, unit: "count", category: "protein", storageType: "fridge", shelfName: "Fridge Shelf", flagged: false },
    { emoji: "🥛", name: "Milk", quantity: 1, unit: "l", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🫙", name: "Curd", quantity: 400, unit: "g", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🧀", name: "Paneer", quantity: 200, unit: "g", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🧈", name: "Butter", quantity: 100, unit: "g", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🍗", name: "Chicken", quantity: 500, unit: "g", category: "protein", storageType: "fridge", shelfName: "Meat & Fish", flagged: false },
    // Fridge – fresh produce
    { emoji: "🥬", name: "Spinach", quantity: 200, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🍅", name: "Tomato", quantity: 6, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🧅", name: "Onion", quantity: 4, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🌶️", name: "Green Chilli", quantity: 10, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🌿", name: "Fresh Coriander", quantity: 50, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🫚", name: "Ginger", quantity: 50, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🧄", name: "Garlic", quantity: 50, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🥕", name: "Carrot", quantity: 3, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🫑", name: "Capsicum", quantity: 2, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🍋", name: "Lemon", quantity: 4, unit: "count", category: "fruit", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🥦", name: "Cabbage", quantity: 1, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    // Pantry – light staples
    { emoji: "🍚", name: "Rice", quantity: 1, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "Whole Wheat Flour", quantity: 1, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🫙", name: "Mustard Oil", quantity: 500, unit: "ml", category: "condiment", storageType: "pantry", shelfName: "Oils & Condiments", flagged: false },
    { emoji: "🧂", name: "Salt", quantity: 500, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🟡", name: "Turmeric Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌶️", name: "Red Chilli Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Coriander Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
  ],

  "pantry-heavy": [
    // Fridge – minimal
    { emoji: "🥚", name: "Eggs", quantity: 6, unit: "count", category: "protein", storageType: "fridge", shelfName: "Fridge Shelf", flagged: false },
    { emoji: "🥛", name: "Milk", quantity: 500, unit: "ml", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🧅", name: "Onion", quantity: 3, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🍅", name: "Tomato", quantity: 3, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    // Pantry – grains & legumes
    { emoji: "🍚", name: "Basmati Rice", quantity: 2, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "Whole Wheat Flour", quantity: 2, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🫘", name: "Toor Dal", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟢", name: "Moong Dal", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟡", name: "Chana Dal", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🫘", name: "Rajma", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟡", name: "Chickpeas", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟡", name: "Besan", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "Poha", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "Semolina", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    // Pantry – spices
    { emoji: "🌿", name: "Cumin Seeds", quantity: 100, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Mustard Seeds", quantity: 100, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Coriander Powder", quantity: 100, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🟡", name: "Turmeric Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌶️", name: "Red Chilli Powder", quantity: 100, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Garam Masala", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Asafoetida", quantity: 10, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Fennel Seeds", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Bay Leaves", quantity: 10, unit: "count", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌶️", name: "Dried Red Chillies", quantity: 15, unit: "count", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Black Pepper", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Cardamom", quantity: 20, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Cloves", quantity: 20, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Cinnamon", quantity: 20, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🧂", name: "Salt", quantity: 500, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    // Pantry – oils & condiments
    { emoji: "🫙", name: "Mustard Oil", quantity: 1, unit: "l", category: "condiment", storageType: "pantry", shelfName: "Oils & Condiments", flagged: false },
    { emoji: "🍬", name: "Sugar", quantity: 500, unit: "g", category: "other", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
  ],

  "well-stocked": [
    // Fridge – proteins & dairy
    { emoji: "🥚", name: "Eggs", quantity: 12, unit: "count", category: "protein", storageType: "fridge", shelfName: "Fridge Shelf", flagged: false },
    { emoji: "🥛", name: "Milk", quantity: 2, unit: "l", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🫙", name: "Curd", quantity: 500, unit: "g", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🧀", name: "Paneer", quantity: 400, unit: "g", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🧈", name: "Butter", quantity: 200, unit: "g", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🥛", name: "Fresh Cream", quantity: 200, unit: "ml", category: "dairy", storageType: "fridge", shelfName: "Dairy", flagged: false },
    { emoji: "🍗", name: "Chicken", quantity: 1, unit: "kg", category: "protein", storageType: "fridge", shelfName: "Meat & Fish", flagged: false },
    { emoji: "🐟", name: "Fish", quantity: 500, unit: "g", category: "protein", storageType: "fridge", shelfName: "Meat & Fish", flagged: false },
    // Fridge – fresh produce
    { emoji: "🥬", name: "Spinach", quantity: 300, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🌿", name: "Fenugreek Leaves", quantity: 100, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🍅", name: "Tomato", quantity: 6, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🧅", name: "Onion", quantity: 4, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🌶️", name: "Green Chilli", quantity: 20, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🌿", name: "Fresh Coriander", quantity: 100, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🫚", name: "Ginger", quantity: 100, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🧄", name: "Garlic", quantity: 100, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🥕", name: "Carrot", quantity: 4, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🫑", name: "Capsicum", quantity: 3, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🥦", name: "Cauliflower", quantity: 1, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🥔", name: "Potato", quantity: 4, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🍋", name: "Lemon", quantity: 6, unit: "count", category: "fruit", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🫐", name: "Beetroot", quantity: 2, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🥬", name: "Curry Leaves", quantity: 20, unit: "count", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    { emoji: "🌿", name: "Mint", quantity: 30, unit: "g", category: "vegetable", storageType: "fridge", shelfName: "Produce", flagged: false },
    // Pantry – grains & legumes
    { emoji: "🍚", name: "Basmati Rice", quantity: 3, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "Whole Wheat Flour", quantity: 3, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🫘", name: "Toor Dal", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟢", name: "Moong Dal", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟡", name: "Chana Dal", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟠", name: "Masoor Dal", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🫘", name: "Rajma", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟡", name: "Chickpeas", quantity: 1, unit: "kg", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "Poha", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "Semolina", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🟡", name: "Besan", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "All-Purpose Flour", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Baking", flagged: false },
    { emoji: "🌾", name: "Rice Flour", quantity: 500, unit: "g", category: "grain", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    // Pantry – spices
    { emoji: "🌿", name: "Cumin Seeds", quantity: 100, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Mustard Seeds", quantity: 100, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Coriander Powder", quantity: 100, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🟡", name: "Turmeric Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌶️", name: "Red Chilli Powder", quantity: 100, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Garam Masala", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Asafoetida", quantity: 10, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Fennel Seeds", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Fenugreek Seeds", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Bay Leaves", quantity: 20, unit: "count", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌶️", name: "Dried Red Chillies", quantity: 20, unit: "count", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Black Pepper", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Cardamom", quantity: 20, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Cloves", quantity: 20, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Cinnamon", quantity: 20, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Kashmiri Red Chilli Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Cumin Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🧂", name: "Salt", quantity: 1, unit: "kg", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🌿", name: "Dry Mango Powder", quantity: 50, unit: "g", category: "spice", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    // Pantry – oils, condiments & baking
    { emoji: "🫙", name: "Mustard Oil", quantity: 1, unit: "l", category: "condiment", storageType: "pantry", shelfName: "Oils & Condiments", flagged: false },
    { emoji: "🫙", name: "Sunflower Oil", quantity: 1, unit: "l", category: "condiment", storageType: "pantry", shelfName: "Oils & Condiments", flagged: false },
    { emoji: "🫙", name: "Ghee", quantity: 500, unit: "g", category: "condiment", storageType: "pantry", shelfName: "Oils & Condiments", flagged: false },
    { emoji: "🍬", name: "Sugar", quantity: 1, unit: "kg", category: "other", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🍬", name: "Jaggery", quantity: 250, unit: "g", category: "other", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🍶", name: "Vinegar", quantity: 200, unit: "ml", category: "condiment", storageType: "pantry", shelfName: "Oils & Condiments", flagged: false },
    { emoji: "🍶", name: "Soy Sauce", quantity: 200, unit: "ml", category: "condiment", storageType: "pantry", shelfName: "Oils & Condiments", flagged: false },
    { emoji: "🫙", name: "Baking Powder", quantity: 100, unit: "g", category: "other", storageType: "pantry", shelfName: "Baking", flagged: false },
    { emoji: "🌾", name: "Sesame Seeds", quantity: 100, unit: "g", category: "other", storageType: "pantry", shelfName: "Spices & Herbs", flagged: false },
    { emoji: "🥜", name: "Peanuts", quantity: 200, unit: "g", category: "protein", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
    { emoji: "🌾", name: "Dried Coconut", quantity: 100, unit: "g", category: "other", storageType: "pantry", shelfName: "Dry Goods & Grains", flagged: false },
  ],
};
