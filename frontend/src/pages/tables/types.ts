export interface DiningZone { id: string; name: string; sort_order: number }
export interface DiningTable {
  id: string; zone_id: string; table_number: string; qr_url: string | null;
  short_code: string; is_open: boolean; last_order_at: string | null;
  last_unpaid_order_at: string | null;
}
