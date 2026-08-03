// Item categories for found-item classification
export const ITEM_CATEGORIES = [
  { value: "electronics", label: "Electronics", icon: "💻" },
  { value: "cash", label: "Cash / Currency", icon: "💰" },
  { value: "documents", label: "Documents / ID", icon: "📄" },
  { value: "clothing", label: "Clothing / Accessories", icon: "👕" },
  { value: "bags", label: "Bags / Luggage", icon: "🎒" },
  { value: "keys", label: "Keys", icon: "🔑" },
  { value: "jewellery", label: "Jewellery / Watches", icon: "💍" },
  { value: "medication", label: "Medication", icon: "💊" },
  { value: "food", label: "Food / Beverages", icon: "🍱" },
  { value: "toys", label: "Toys / Children Items", icon: "🧸" },
  { value: "books", label: "Books / Media", icon: "📚" },
  { value: "other", label: "Other", icon: "📦" },
] as const;

export type ItemCategory = typeof ITEM_CATEGORIES[number]["value"];

// Terminal options
export const TERMINALS = [
  { value: "T1", label: "Terminal 1" },
  { value: "T2", label: "Terminal 2" },
  { value: "T3", label: "Terminal 3" },
  { value: "T4", label: "Terminal 4" },
  { value: "Jewel", label: "Jewel" },
] as const;

export type Terminal = typeof TERMINALS[number]["value"];

// Area options
export const AREAS = [
  { value: "Public Area", label: "Public Area" },
  { value: "Transit Area", label: "Transit Area" },
  { value: "Gate Hold Room", label: "Gate Hold Room" },
  { value: "Unsure", label: "Unsure" },
] as const;

export type Area = typeof AREAS[number]["value"];

// Item condition options
export const ITEM_CONDITIONS = [
  { value: "intact", label: "Intact" },
  { value: "damaged", label: "Damaged" },
  { value: "wet", label: "Wet" },
  { value: "open", label: "Open" },
  { value: "sealed", label: "Sealed" },
  { value: "other", label: "Other" },
] as const;

export type ItemCondition = typeof ITEM_CONDITIONS[number]["value"];

// Categories that show bag/wallet/clothing/electronics matching fields
export const PHYSICAL_ITEM_CATEGORIES: ItemCategory[] = ["bags", "clothing", "electronics"];

// Categories that show document matching fields
export const DOCUMENT_CATEGORIES: ItemCategory[] = ["documents"];

// Categories that show jewellery matching fields
export const JEWELLERY_CATEGORIES: ItemCategory[] = ["jewellery"];

// Categories that show cash matching fields
export const CASH_CATEGORIES: ItemCategory[] = ["cash"];

// Kept for backward compatibility with existing data — maps old flat values to terminal+area
export const LOCATION_PRESETS = [
  { value: "T1 Departure", label: "T1 Departure" },
  { value: "T1 Arrival", label: "T1 Arrival" },
  { value: "T1 Transit", label: "T1 Transit" },
  { value: "T2 Departure", label: "T2 Departure" },
  { value: "T2 Arrival", label: "T2 Arrival" },
  { value: "T2 Transit", label: "T2 Transit" },
  { value: "T3 Departure", label: "T3 Departure" },
  { value: "T3 Arrival", label: "T3 Arrival" },
  { value: "T3 Transit", label: "T3 Transit" },
  { value: "T4 Departure", label: "T4 Departure" },
  { value: "T4 Arrival", label: "T4 Arrival" },
  { value: "Aircraft", label: "Aircraft (specify flight)" },
  { value: "Bus / Shuttle", label: "Bus / Shuttle" },
  { value: "Taxi Stand", label: "Taxi Stand" },
  { value: "Car Park", label: "Car Park" },
  { value: "Lounge", label: "Lounge" },
  { value: "Other", label: "Other" },
] as const;

export type LocationPreset = typeof LOCATION_PRESETS[number]["value"];
