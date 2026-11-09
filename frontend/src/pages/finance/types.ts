export type FinanceMethod = "cash" | "transfer" | "qr" | "card" | "other";
export type FinanceKind = "income" | "expense" | "cost";
export type FinanceCurrency = "LAK" | "THB" | "USD";
export interface FinanceAccess { view: boolean; edit: boolean; owner: boolean }
export interface FinanceTotals { sales: string; otherIncome: string; income: string; expense: string; inventoryPurchases: string; cost: string; net: string; incompleteCostOrders: number; possibleDuplicateCostExpenses: number }
export interface FinanceDay { date: string; income: string; expense: string; cost: string; bills?: number }
export interface FinanceAccount { method: FinanceMethod; name: string | null; opening_date: string | null; opening_balance: string | null; income: string; expense: string; balance: string; configured: boolean }
export interface FinanceEntry { id: string; entryId: string; kind: FinanceKind; source: string; amount: string; currency_code: FinanceCurrency; currency_amount: string; exchange_rate: string; date: string; category: string; description: string; payment_method: string; reference: string; treatment: "operating" | "inventory"; voided_at: string | null; void_reason: string | null; cost_incomplete: boolean; bill_number: string | null; table_name: string | null; operator: string | null; receipt_id: string | null; replaces_id: string | null; created_at: string }
export interface FinanceLedger { summary: FinanceTotals; categories: Array<{ category: string; kind: string; amount: string }>; daily: FinanceDay[]; count: number; entries: FinanceEntry[]; page: number; pageSize: number }
export interface FinanceConfig { incomeCategories: string[]; expenseCategories: string[]; viewRoles: string[]; editRoles: string[]; currency: FinanceCurrency; paymentMethods: FinanceMethod[] }
export interface FinanceWorkspace {
  today: FinanceTotals; month: FinanceTotals; selected: FinanceTotals; bills: number;
  payments: Array<{ method: FinanceMethod; amount: string }>;
  menus: Array<{ id: string; name: string; quantity: string; sales: string }>;
  staff: Array<{ name: string; bills: number; sales: string }>;
  costs: Array<{ id: string; name: string; price: string; cost_price: string; recipe_cost: string; missing: number; components: Array<{ id: string; name: string; unit: string; quantity: string; unit_cost: string | null }> }>;
  ingredients: Array<{ id: string; name: string; unit: string; unit_cost: string | null; balance: string; used: string }>;
  config: FinanceConfig;
  restaurant: { vat_pct: string; service_charge_pct: string };
  accounts: FinanceAccount[];
  closings: Array<{ id: string; close_date: string; snapshot: { summary: FinanceTotals; accounts: FinanceAccount[] }; actual: Record<FinanceMethod, string>; note: string; created_at: string; operator: string | null }>;
  transfers: Array<{ id: string; from_method: FinanceMethod; to_method: FinanceMethod; amount: string; entry_date: string; note: string; created_at: string; operator: string | null }>;
  day: string; canEdit: boolean; isOwner: boolean; currencyEditable: boolean;
}
