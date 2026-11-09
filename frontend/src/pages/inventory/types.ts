export interface StockLocation {
  id: string;
  name: string;
  is_default: boolean;
  active: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  minimum_stock: string | number;
  track_stock: boolean;
  allow_negative: boolean;
  active: boolean;
  image_url: string | null;
  quantity: string | number;
}

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  item_name: string;
  quantity_delta: string | number;
  movement_type: string;
  note: string | null;
  occurred_at: string;
  unit: string;
  location_name: string;
  actor_name: string | null;
}

export interface MenuItem {
  id: string;
  name: string;
  active: boolean;
  available: boolean;
}

export interface RecipeComponent {
  menu_id: string;
  inventory_item_id: string;
  quantity: string | number;
  menu_name: string;
  inventory_item_name: string;
  unit: string;
}

export type InventoryTab = "items" | "low" | "movements" | "recipes";
