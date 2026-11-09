import {r as getSession} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';

export async function withTicketOperator(ticket) {
  try {
    const session = await getSession();
    const user = session?.user;
    return {...ticket, operatorName: user?.displayName?.trim() || user?.email || '—'};
  } catch {
    return {...ticket, operatorName: '—'};
  }
}

export function ticketMetadata(ticket) {
  const labels = ticket.locale === 'lo'
    ? {zone: 'ໂຊນ', receipt: 'ເລກທີໃບບິນ', user: 'ຜູ້ໃຊ້ລະບົບ'}
    : ticket.locale === 'en'
    ? {zone: 'Zone', receipt: 'Receipt no.', user: 'User'}
    : {zone: 'โซน', receipt: 'เลขที่บิล', user: 'ผู้ใช้ระบบ'};
  return {...labels, number: String(ticket.order.receipt_number || '—'), operator: String(ticket.operatorName || '—')};
}
