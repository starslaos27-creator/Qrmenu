export type DepositStatus = "pending" | "picked_up" | "expired";

export interface StockDeposit {
  id: string;
  customer_name: string;
  customer_contact: string | null;
  product_name: string;
  quantity: string | number;
  unit: string;
  due_date: string;
  note: string | null;
  status: DepositStatus;
  created_at: string;
  picked_up_at: string | null;
  expired_at: string | null;
}

export interface CreateDepositInput {
  customer_name: string;
  customer_contact?: string;
  product_name: string;
  quantity: number;
  unit: string;
  due_date: string;
  note?: string;
}
