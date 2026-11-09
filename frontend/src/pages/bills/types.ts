export interface BillOrder {
  id: string; table_id: string; items: Array<{ menu_id?: string; name?: string; qty?: number; price?: number }>;
  status: string; total: string | number; paid: boolean; paid_at: string | null;
  payment_method: string | null; receipt_number: string | null; created_at: string;
  settled_total?: string | number | null;
  bill_total?: string | number | null; cash_received?: string | number | null;
  transfer_amount?: string | number | null; change_due?: string | number | null;
}
export interface BillTable { id: string; table_number: string; is_open: boolean; zone_id: string | null; bill_check_requested_at?: string | null }
export interface BillZone { id: string; name: string }
export interface StaffCall { id: string; table_id: string; table_number: string; zone_name: string | null; reason: string | null; created_at: string; acknowledged: boolean }
export interface BillRestaurant { name: string; currency_code: "LAK" | "THB" | "USD"; service_charge_pct: number | string; vat_pct: number | string; payment_qr_url: string | null }
