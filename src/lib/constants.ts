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

// Location presets for airport/transit found items
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
