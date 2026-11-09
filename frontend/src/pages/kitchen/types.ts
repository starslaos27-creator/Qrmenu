export interface OrderItem {
  menu_id: string;
  qty: number;
  note?: string | null;
  unit_price?: number;
}

export interface ItemConfirmation {
  user_id: string;
  user_name: string;
  confirmed_at: string;
}

export interface KitchenOrder {
  id: string;
  table_id: string;
  restaurant_id: string;
  items: OrderItem[];
  status: "pending" | "ready" | "served" | "cancelled";
  total: number | string;
  paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  receipt_number: string | null;
  receipt_user: string | null;
  item_confirmations: Record<string, ItemConfirmation> | null;
  cancel_reason: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export interface KitchenMenu {
  id: string;
  name: string;
  name_lo: string | null;
  name_en: string | null;
  description?: string | null;
  price: number | string;
}

export interface KitchenTable {
  id: string;
  table_number: string | number;
  zone_id: string | null;
}

export interface KitchenZone {
  id: string;
  name: string;
}

export interface KitchenData {
  restaurantId: string;
  restaurantName: string;
  currencyCode: "LAK" | "THB" | "USD";
  role: string;
  kitchenPrintWidth: 58 | 76 | 80;
  orders: KitchenOrder[];
  history: KitchenOrder[];
  menus: KitchenMenu[];
  tables: KitchenTable[];
  zones: KitchenZone[];
  memberEmails: Record<string, string>;
}
