import type { Locale } from "../../shared/i18n/LanguageProvider";

export interface BillLabels {
  title: string; subtitle: string; autoRefresh: string; live: string;
  openBills: string; outstanding: string; staffCalls: string; unpaidTab: string; settledTab: string;
  loading: string; noUnpaid: string; noHistory: string; tryAgain: string;
  calls: string; table: string; checkingBill: string; acknowledged: string; takeCall: string; acknowledge: string;
  date: string; receiptNumber: string; paymentAndChange: string; orders: string; total: string; actions: string; printReceipt: string;
  orderCount: string; unknownZone: string; waitingPayment: string; fallbackItem: string; items: string;
  subtotal: string; serviceCharge: string; vat: string; amountDue: string; collectPayment: string; moveTable: string;
  paymentTitle: string; collectAll: string; dueNow: string; paymentMethod: string; cash: string; transfer: string;
  promptpay: string; card: string; other: string; cashReceived: string; change: string; cancel: string; confirmPayment: string;
  processing: string; qrAlt: string; moveTitle: string; moveDescription: string; destination: string; chooseDestination: string;
  confirmMove: string; tableDeleted: string; noRestaurant: string; accountLoadFailed: string; loginRequired: string;
  insufficientStock: string; cashTooLow: string; paymentFailed: string; transferFailed: string; acknowledgeFailed: string;
  loadFailed: string; loadingAccount: string;
  receipt: string; number: string; method: string; item: string; cashLabel: string; changeLabel: string; totalLabel: string;
}

export const billLabels: Record<Locale, BillLabels> = {
  th: {
    title: "บิลและการชำระเงิน", subtitle: "จัดการบิลค้าง รับชำระ และดูประวัติใบเสร็จ", autoRefresh: "อัปเดตอัตโนมัติทุก 5 วินาที", live: "อัปเดตสด",
    openBills: "โต๊ะที่มียอดค้าง", outstanding: "ยอดค้างชำระ", staffCalls: "เรียกพนักงาน", unpaidTab: "บิลค้าง", settledTab: "ชำระแล้ว · 30 วัน",
    loading: "กำลังโหลดบิล…", noUnpaid: "ไม่มีบิลค้างในขณะนี้", noHistory: "ยังไม่มีประวัติการชำระในช่วง 30 วัน", tryAgain: "ลองอีกครั้ง",
    calls: "เรียกพนักงาน", table: "โต๊ะ", checkingBill: "กำลังเช็กบิล", acknowledged: "รับเรื่องแล้ว", takeCall: "รับเช็กบิล", acknowledge: "รับทราบ",
    date: "วันเวลา", receiptNumber: "เลขที่ใบเสร็จ", paymentAndChange: "วิธีชำระ / เงินทอน", orders: "ออเดอร์", total: "ยอดรวม", actions: "จัดการ", printReceipt: "พิมพ์ใบเสร็จ",
    orderCount: "ออเดอร์", unknownZone: "ไม่ระบุโซน", waitingPayment: "รอชำระ", fallbackItem: "รายการอาหาร", items: "รายการ",
    subtotal: "รวมอาหาร", serviceCharge: "ค่าบริการ", vat: "ภาษี VAT", amountDue: "ยอดที่ต้องชำระ", collectPayment: "รับชำระ", moveTable: "ย้ายโต๊ะ",
    paymentTitle: "รับชำระเงิน", collectAll: "รับชำระบิลทั้งหมดของโต๊ะ", dueNow: "ยอดที่ต้องชำระ", paymentMethod: "วิธีชำระ", cash: "เงินสด", transfer: "โอนเงิน",
    promptpay: "PromptPay / QR", card: "บัตร", other: "อื่น ๆ", cashReceived: "จำนวนเงินสดที่รับ", change: "เงินทอน", cancel: "ยกเลิก", confirmPayment: "ยืนยันชำระ",
    processing: "กำลังดำเนินการ…", qrAlt: "QR รับชำระ", moveTitle: "ย้ายออเดอร์ไปอีกโต๊ะ", moveDescription: "เลือกโต๊ะปลายทาง ออเดอร์ที่ยังไม่ชำระจะย้ายไปพร้อมกัน", destination: "โต๊ะปลายทาง", chooseDestination: "เลือกโต๊ะปลายทาง",
    confirmMove: "ยืนยันย้ายโต๊ะ", tableDeleted: "โต๊ะถูกลบ", noRestaurant: "บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร", accountLoadFailed: "โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง", loginRequired: "กรุณาเข้าสู่ระบบเพื่อดูบิล",
    insufficientStock: "รับชำระไม่ได้ เพราะวัตถุดิบคงเหลือไม่พอ", cashTooLow: "จำนวนเงินสดที่รับมายังไม่ครบยอดบิล", paymentFailed: "รับชำระไม่สำเร็จ กรุณาลองใหม่", transferFailed: "ย้ายออเดอร์ไม่สำเร็จ กรุณาตรวจสอบโต๊ะปลายทาง", acknowledgeFailed: "รับทราบการเรียกพนักงานไม่สำเร็จ",
    loadFailed: "โหลดบิลไม่สำเร็จ กรุณาลองใหม่", loadingAccount: "กำลังโหลดข้อมูลบัญชี…", receipt: "ใบเสร็จรับเงิน", number: "เลขที่", method: "วิธีชำระ", item: "รายการอาหาร", cashLabel: "รับเงินสด", changeLabel: "เงินทอน", totalLabel: "ยอดรวม",
  },
  lo: {
    title: "ໃບບິນ ແລະ ການຊຳລະ", subtitle: "ຈັດການໃບບິນຄ້າງ, ຮັບຊຳລະ ແລະ ເບິ່ງປະຫວັດໃບຮັບເງິນ", autoRefresh: "ອັບເດດອັດຕະໂນມັດທຸກ 5 ວິນາທີ", live: "ອັບເດດສົດ",
    openBills: "ໂຕະທີ່ຄ້າງຊຳລະ", outstanding: "ຍອດຄ້າງຊຳລະ", staffCalls: "ເອີ້ນພະນັກງານ", unpaidTab: "ໃບບິນຄ້າງ", settledTab: "ຊຳລະແລ້ວ · 30 ວັນ",
    loading: "ກຳລັງໂຫຼດໃບບິນ…", noUnpaid: "ຕອນນີ້ບໍ່ມີໃບບິນຄ້າງ", noHistory: "ຍັງບໍ່ມີປະຫວັດການຊຳລະໃນ 30 ວັນ", tryAgain: "ລອງອີກຄັ້ງ",
    calls: "ເອີ້ນພະນັກງານ", table: "ໂຕະ", checkingBill: "ກຳລັງເຊັກບິນ", acknowledged: "ຮັບເລື່ອງແລ້ວ", takeCall: "ຮັບເຊັກບິນ", acknowledge: "ຮັບຊາບ",
    date: "ວັນເວລາ", receiptNumber: "ເລກທີໃບຮັບເງິນ", paymentAndChange: "ວິທີຊຳລະ / ເງິນທອນ", orders: "ອໍເດີ", total: "ຍອດລວມ", actions: "ຈັດການ", printReceipt: "ພິມໃບຮັບເງິນ",
    orderCount: "ອໍເດີ", unknownZone: "ບໍ່ລະບຸໂຊນ", waitingPayment: "ລໍຖ້າຊຳລະ", fallbackItem: "ລາຍການອາຫານ", items: "ລາຍການ",
    subtotal: "ລວມອາຫານ", serviceCharge: "ຄ່າບໍລິການ", vat: "ພາສີ VAT", amountDue: "ຍອດທີ່ຕ້ອງຊຳລະ", collectPayment: "ຮັບຊຳລະ", moveTable: "ຍ້າຍໂຕະ",
    paymentTitle: "ຮັບຊຳລະເງິນ", collectAll: "ຮັບຊຳລະບິນທັງໝົດຂອງໂຕະ", dueNow: "ຍອດທີ່ຕ້ອງຊຳລະ", paymentMethod: "ວິທີຊຳລະ", cash: "ເງິນສົດ", transfer: "ໂອນເງິນ",
    promptpay: "PromptPay / QR", card: "ບັດ", other: "ອື່ນໆ", cashReceived: "ຈຳນວນເງິນສົດທີ່ຮັບ", change: "ເງິນທອນ", cancel: "ຍົກເລີກ", confirmPayment: "ຢືນຢັນຊຳລະ",
    processing: "ກຳລັງດຳເນີນການ…", qrAlt: "QR ຮັບຊຳລະ", moveTitle: "ຍ້າຍອໍເດີໄປໂຕະອື່ນ", moveDescription: "ເລືອກໂຕະປາຍທາງ, ອໍເດີທີ່ຍັງບໍ່ຊຳລະຈະຍ້າຍໄປນຳ", destination: "ໂຕະປາຍທາງ", chooseDestination: "ເລືອກໂຕະປາຍທາງ",
    confirmMove: "ຢືນຢັນຍ້າຍໂຕະ", tableDeleted: "ໂຕະຖືກລຶບ", noRestaurant: "ບັນຊີນີ້ຍັງບໍ່ໄດ້ເຂົ້າຮ່ວມຮ້ານ", accountLoadFailed: "ໂຫຼດຂໍ້ມູນບັນຊີບໍ່ສຳເລັດ ກະລຸນາເຂົ້າລະບົບອີກຄັ້ງ", loginRequired: "ກະລຸນາເຂົ້າລະບົບເພື່ອເບິ່ງໃບບິນ",
    insufficientStock: "ຮັບຊຳລະບໍ່ໄດ້ ເພາະວັດຖຸດິບບໍ່ພຽງພໍ", cashTooLow: "ຈຳນວນເງິນສົດທີ່ຮັບຍັງບໍ່ຄົບຍອດ", paymentFailed: "ຮັບຊຳລະບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່", transferFailed: "ຍ້າຍອໍເດີບໍ່ສຳເລັດ ກະລຸນາກວດໂຕະປາຍທາງ", acknowledgeFailed: "ຮັບຊາບການເອີ້ນພະນັກງານບໍ່ສຳເລັດ",
    loadFailed: "ໂຫຼດໃບບິນບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່", loadingAccount: "ກຳລັງໂຫຼດຂໍ້ມູນບັນຊີ…", receipt: "ໃບຮັບເງິນ", number: "ເລກທີ", method: "ວິທີຊຳລະ", item: "ລາຍການອາຫານ", cashLabel: "ຮັບເງິນສົດ", changeLabel: "ເງິນທອນ", totalLabel: "ຍອດລວມ",
  },
  en: {
    title: "Bills & payments", subtitle: "Manage open bills, take payments, and review receipts", autoRefresh: "Auto-refreshes every 5 seconds", live: "Live",
    openBills: "Tables with open bills", outstanding: "Outstanding", staffCalls: "Staff calls", unpaidTab: "Open bills", settledTab: "Paid · 30 days",
    loading: "Loading bills…", noUnpaid: "There are no open bills right now", noHistory: "No payment history in the last 30 days", tryAgain: "Try again",
    calls: "Staff calls", table: "Table", checkingBill: "Bill requested", acknowledged: "Acknowledged", takeCall: "Take bill request", acknowledge: "Acknowledge",
    date: "Date & time", receiptNumber: "Receipt no.", paymentAndChange: "Payment / change", orders: "Orders", total: "Total", actions: "Actions", printReceipt: "Print receipt",
    orderCount: "orders", unknownZone: "Unassigned zone", waitingPayment: "Awaiting payment", fallbackItem: "Food item", items: "items",
    subtotal: "Food subtotal", serviceCharge: "Service charge", vat: "VAT", amountDue: "Amount due", collectPayment: "Take payment", moveTable: "Move table",
    paymentTitle: "Take payment", collectAll: "Collect all bills for table", dueNow: "Amount due", paymentMethod: "Payment method", cash: "Cash", transfer: "Bank transfer",
    promptpay: "PromptPay / QR", card: "Card", other: "Other", cashReceived: "Cash received", change: "Change", cancel: "Cancel", confirmPayment: "Confirm payment",
    processing: "Processing…", qrAlt: "Payment QR code", moveTitle: "Move orders to another table", moveDescription: "Choose a destination. All unpaid orders will move together.", destination: "Destination table", chooseDestination: "Choose a table",
    confirmMove: "Move orders", tableDeleted: "Table removed", noRestaurant: "This account is not a member of a restaurant", accountLoadFailed: "Could not load account. Please sign in again.", loginRequired: "Please sign in to view bills",
    insufficientStock: "Payment failed because there is not enough inventory", cashTooLow: "Cash received is less than the bill total", paymentFailed: "Could not take payment. Please try again.", transferFailed: "Could not move orders. Check the destination table.", acknowledgeFailed: "Could not acknowledge the staff call",
    loadFailed: "Could not load bills. Please try again.", loadingAccount: "Loading account…", receipt: "Receipt", number: "No.", method: "Payment method", item: "Food item", cashLabel: "Cash received", changeLabel: "Change", totalLabel: "Total",
  },
  ko: {
    title: "계산서 및 결제", subtitle: "미결제 계산서 처리 및 영수증 내역 확인", autoRefresh: "5초마다 자동 업데이트", live: "실시간",
    openBills: "미결제 테이블", outstanding: "미결제 금액", staffCalls: "직원 호출", unpaidTab: "미결제", settledTab: "결제 완료 · 30일",
    loading: "계산서를 불러오는 중…", noUnpaid: "현재 미결제 계산서가 없습니다", noHistory: "최근 30일 결제 내역이 없습니다", tryAgain: "다시 시도",
    calls: "직원 호출", table: "테이블", checkingBill: "계산서 요청", acknowledged: "확인됨", takeCall: "계산서 요청 확인", acknowledge: "확인",
    date: "날짜 및 시간", receiptNumber: "영수증 번호", paymentAndChange: "결제 / 거스름돈", orders: "주문", total: "합계", actions: "작업", printReceipt: "영수증 인쇄",
    orderCount: "건 주문", unknownZone: "구역 미지정", waitingPayment: "결제 대기", fallbackItem: "음식 항목", items: "항목",
    subtotal: "음식 소계", serviceCharge: "서비스 요금", vat: "부가세", amountDue: "결제 금액", collectPayment: "결제 받기", moveTable: "테이블 이동",
    paymentTitle: "결제 받기", collectAll: "테이블의 모든 계산서 결제", dueNow: "결제 금액", paymentMethod: "결제 방법", cash: "현금", transfer: "계좌 이체",
    promptpay: "PromptPay / QR", card: "카드", other: "기타", cashReceived: "받은 현금", change: "거스름돈", cancel: "취소", confirmPayment: "결제 확인",
    processing: "처리 중…", qrAlt: "결제 QR 코드", moveTitle: "주문을 다른 테이블로 이동", moveDescription: "이동할 테이블을 선택하세요. 미결제 주문이 함께 이동합니다.", destination: "이동할 테이블", chooseDestination: "테이블 선택",
    confirmMove: "주문 이동", tableDeleted: "삭제된 테이블", noRestaurant: "이 계정은 식당에 가입되어 있지 않습니다", accountLoadFailed: "계정 정보를 불러오지 못했습니다. 다시 로그인하세요.", loginRequired: "계산서를 보려면 로그인하세요",
    insufficientStock: "재고가 부족하여 결제할 수 없습니다", cashTooLow: "받은 현금이 결제 금액보다 적습니다", paymentFailed: "결제에 실패했습니다. 다시 시도하세요.", transferFailed: "주문을 이동할 수 없습니다. 이동할 테이블을 확인하세요.", acknowledgeFailed: "직원 호출을 확인할 수 없습니다",
    loadFailed: "계산서를 불러오지 못했습니다. 다시 시도하세요.", loadingAccount: "계정 정보를 불러오는 중…", receipt: "영수증", number: "번호", method: "결제 방법", item: "음식", cashLabel: "받은 현금", changeLabel: "거스름돈", totalLabel: "합계",
  },
  vi: {
    title: "Hóa đơn và thanh toán", subtitle: "Quản lý hóa đơn chưa thanh toán và xem biên lai", autoRefresh: "Tự cập nhật mỗi 5 giây", live: "Trực tiếp",
    openBills: "Bàn còn hóa đơn", outstanding: "Còn phải thu", staffCalls: "Gọi nhân viên", unpaidTab: "Chưa thanh toán", settledTab: "Đã thanh toán · 30 ngày",
    loading: "Đang tải hóa đơn…", noUnpaid: "Hiện không có hóa đơn chưa thanh toán", noHistory: "Chưa có lịch sử thanh toán trong 30 ngày qua", tryAgain: "Thử lại",
    calls: "Gọi nhân viên", table: "Bàn", checkingBill: "Yêu cầu tính tiền", acknowledged: "Đã tiếp nhận", takeCall: "Nhận yêu cầu tính tiền", acknowledge: "Xác nhận",
    date: "Ngày giờ", receiptNumber: "Số biên lai", paymentAndChange: "Thanh toán / tiền thừa", orders: "Đơn hàng", total: "Tổng cộng", actions: "Thao tác", printReceipt: "In biên lai",
    orderCount: "đơn", unknownZone: "Chưa chọn khu", waitingPayment: "Chờ thanh toán", fallbackItem: "Món ăn", items: "món",
    subtotal: "Tạm tính món ăn", serviceCharge: "Phí dịch vụ", vat: "VAT", amountDue: "Số tiền cần trả", collectPayment: "Nhận thanh toán", moveTable: "Chuyển bàn",
    paymentTitle: "Nhận thanh toán", collectAll: "Thu tất cả hóa đơn của bàn", dueNow: "Số tiền cần trả", paymentMethod: "Phương thức thanh toán", cash: "Tiền mặt", transfer: "Chuyển khoản",
    promptpay: "PromptPay / QR", card: "Thẻ", other: "Khác", cashReceived: "Tiền mặt nhận", change: "Tiền thừa", cancel: "Hủy", confirmPayment: "Xác nhận thanh toán",
    processing: "Đang xử lý…", qrAlt: "Mã QR thanh toán", moveTitle: "Chuyển đơn sang bàn khác", moveDescription: "Chọn bàn đích. Các đơn chưa thanh toán sẽ được chuyển cùng nhau.", destination: "Bàn đích", chooseDestination: "Chọn bàn đích",
    confirmMove: "Xác nhận chuyển bàn", tableDeleted: "Bàn đã bị xóa", noRestaurant: "Tài khoản này chưa tham gia nhà hàng", accountLoadFailed: "Không tải được tài khoản. Vui lòng đăng nhập lại.", loginRequired: "Vui lòng đăng nhập để xem hóa đơn",
    insufficientStock: "Không thể thanh toán vì không đủ hàng tồn kho", cashTooLow: "Tiền mặt nhận được chưa đủ tổng hóa đơn", paymentFailed: "Thanh toán không thành công. Vui lòng thử lại.", transferFailed: "Không chuyển được đơn. Hãy kiểm tra bàn đích.", acknowledgeFailed: "Không thể xác nhận cuộc gọi nhân viên",
    loadFailed: "Không tải được hóa đơn. Vui lòng thử lại.", loadingAccount: "Đang tải tài khoản…", receipt: "Biên lai", number: "Số", method: "Phương thức thanh toán", item: "Món ăn", cashLabel: "Tiền mặt nhận", changeLabel: "Tiền thừa", totalLabel: "Tổng cộng",
  },
  zh: {
    title: "账单与付款", subtitle: "处理未结账单并查看收据记录", autoRefresh: "每 5 秒自动更新", live: "实时更新",
    openBills: "待结账桌台", outstanding: "待收金额", staffCalls: "服务呼叫", unpaidTab: "未结账单", settledTab: "已付款 · 30 天",
    loading: "正在加载账单…", noUnpaid: "目前没有未结账单", noHistory: "最近 30 天没有付款记录", tryAgain: "重试",
    calls: "服务呼叫", table: "桌号", checkingBill: "请求结账", acknowledged: "已受理", takeCall: "受理结账请求", acknowledge: "确认",
    date: "日期和时间", receiptNumber: "收据编号", paymentAndChange: "付款方式 / 找零", orders: "订单", total: "总计", actions: "操作", printReceipt: "打印收据",
    orderCount: "笔订单", unknownZone: "未分配区域", waitingPayment: "待付款", fallbackItem: "餐品", items: "项",
    subtotal: "餐品小计", serviceCharge: "服务费", vat: "增值税", amountDue: "应付金额", collectPayment: "收款", moveTable: "换桌",
    paymentTitle: "收款", collectAll: "收取此桌的所有账单", dueNow: "应付金额", paymentMethod: "付款方式", cash: "现金", transfer: "银行转账",
    promptpay: "PromptPay / QR", card: "银行卡", other: "其他", cashReceived: "收到现金", change: "找零", cancel: "取消", confirmPayment: "确认付款",
    processing: "处理中…", qrAlt: "付款二维码", moveTitle: "将订单移至其他桌", moveDescription: "选择目标桌，所有未付款订单将一起移动。", destination: "目标桌", chooseDestination: "选择目标桌",
    confirmMove: "确认换桌", tableDeleted: "桌台已删除", noRestaurant: "此账号尚未加入餐厅", accountLoadFailed: "无法加载账号，请重新登录。", loginRequired: "请登录后查看账单",
    insufficientStock: "库存不足，无法完成付款", cashTooLow: "收到的现金少于账单金额", paymentFailed: "付款失败，请重试。", transferFailed: "无法移动订单，请检查目标桌。", acknowledgeFailed: "无法确认服务呼叫",
    loadFailed: "无法加载账单，请重试。", loadingAccount: "正在加载账号…", receipt: "收据", number: "编号", method: "付款方式", item: "餐品", cashLabel: "收到现金", changeLabel: "找零", totalLabel: "总计",
  },
};

export const numberLocale: Record<Locale, string> = { th: "th-TH", lo: "lo-LA", en: "en-US", ko: "ko-KR", vi: "vi-VN", zh: "zh-CN" };
