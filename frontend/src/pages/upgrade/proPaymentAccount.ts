import { useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";

export interface ProPaymentAccount {
  bank: string;
  accountNumber: string;
  accountName: string;
}

export function useProPaymentAccount() {
  const [account, setAccount] = useState<ProPaymentAccount | null>(null);

  useEffect(() => {
    let active = true;
    void apiRequest<{ bankDetails: ProPaymentAccount | null }>("/api/pro-payment-bank-details")
      .then(({ bankDetails }) => {
        if (!active) return;
        const complete = bankDetails && [bankDetails.bank, bankDetails.accountNumber, bankDetails.accountName].every((value) => value?.trim());
        setAccount(complete ? bankDetails : null);
      })
      .catch(() => { if (active) setAccount(null); });
    return () => { active = false; };
  }, []);

  return account;
}
