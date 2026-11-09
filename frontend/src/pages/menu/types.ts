export interface MenuCategory { id: string; name: string; name_lo?: string | null; name_en?: string | null }
export interface RestaurantMenu {
  id: string; category_id: string | null; name: string; name_lo: string | null;
  name_en: string | null; price: string | number; unit: string | null;
  cost_price: string | number; description: string | null; track_stock: boolean;
  stock_quantity: string | number; stock_barcode: string | null;
  low_alert_limit: string | number; image_url: string | null; available: boolean;
  bundles: unknown[];
}
