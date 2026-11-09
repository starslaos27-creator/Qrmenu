export const receiptPrintStyles = `
@page { margin: 4mm; }
* { box-sizing: border-box; }
body { margin:0; color:#182620; font-family:"Sarabun","Noto Sans Lao","Segoe UI",sans-serif; font-size:11px; line-height:1.5; }
h1 { margin:0 0 6px; font-size:18px; font-weight:800; line-height:1.35; overflow-wrap:anywhere; }
.center { text-align:center; padding-bottom:8px; }
.receipt-label { font-size:10px; letter-spacing:.12em; font-weight:700; margin-bottom:7px; }
.meta { font-size:10px; line-height:1.65; }
hr { border:0; border-top:1px dashed #85948b; margin:10px 0; }
table { width:100%; border-collapse:collapse; table-layout:fixed; }
thead { display:table-header-group; }
tr { break-inside:avoid; }
th { font-size:10px; font-weight:700; border-top:1px solid #64776b; border-bottom:1px solid #64776b; }
th,td { padding:7px 2px; vertical-align:top; text-align:left; overflow-wrap:anywhere; }
tbody tr + tr td { border-top:1px solid #e2e7e3; }
.qty { width:13%; text-align:center; font-variant-numeric:tabular-nums; }
.total { width:34%; text-align:right; font-weight:650; font-variant-numeric:tabular-nums; }
.unit { font-size:9px; color:#526157; margin-top:2px; }
.receipt-items .unit-price { width:24%; text-align:right; font-variant-numeric:tabular-nums; }
.receipt-items .qty { width:12%; }
.receipt-items .total { width:26%; }
.receipt-items td.unit-price { font-weight:650; }
.note { font-size:9px; margin-top:3px; font-style:italic; }
.summary { font-size:10px; text-align:right; margin:8px 0; }
.totals { break-inside:avoid; }
.totals td { border:0; }
.grand { border-top:2px solid #254b38 !important; border-bottom:2px solid #254b38 !important; font-size:16px; font-weight:800; padding-top:10px; padding-bottom:10px; }
.footer { text-align:center; font-size:10px; margin-top:18px; padding-top:10px; border-top:1px dashed #85948b; break-inside:avoid; }
.qr-section { text-align:center; margin-top:14px; break-inside:avoid; }
.qr-label { font-size:10px; margin-bottom:6px; }
.qr-section img { display:block; width: min(38mm,100%); height:auto; margin:auto; }
@media (min-width:100mm) {
 @page { margin:15mm; }
 body { max-width:180mm; margin:0 auto; font-size:11pt; line-height:1.55; }
 .center { text-align:left; border-top:4px solid #254b38; padding:18pt 0 12pt; }
 h1 { font-size:24pt; margin-bottom:9pt; }
 .receipt-label { font-size:9pt; color:#46624f; margin-bottom:8pt; }
 .meta { font-size:10pt; line-height:1.65; }
 hr { margin:12pt 0; border-top-style:solid; border-color:#cad3cc; }
 th { font-size:9pt; padding:10pt 8pt; background:#f0f4f1; }
 td { padding:11pt 8pt; }
 .qty { width:12%; }
 .receipt-items .unit-price { width:23%; }
 .receipt-items .total { width:24%; }
 .total { width:26%; }
 .unit,.note { font-size:9pt; }
 .summary { font-size:9pt; margin:10pt 8pt; color:#526157; }
 .totals { width:65%; margin-left:auto; }
 .totals td { padding:7pt 8pt; }
 .totals .total { width:43%; }
 .grand { font-size:18pt; padding:12pt 8pt !important; }
 .footer { margin-top:26pt; padding-top:14pt; font-size:10pt; }
 .qr-section img { width:38mm; }
}
.receipt-header { text-align:center; border-top:0; padding-top:10px; }
.receipt-monogram { display:flex; align-items:center; justify-content:center; width:38px; height:38px; margin:0 auto 6px; border:2px solid #254b38; border-radius:50%; font-size:23px; font-weight:800; }
.receipt-meta-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.35fr); gap:8px; margin-top:10px; font-size:9px; }
.receipt-location { text-align:left; min-width:0; overflow-wrap:anywhere; color:#000; }
.receipt-address { margin:4px 0 8px; text-align:center; font-size:9px; line-height:1.5; color:#000; overflow-wrap:anywhere; }
.receipt-issued .receipt-label { font-size:14px; font-weight:800; letter-spacing:0; line-height:1.35; margin-bottom:6px; }
.receipt-issued { text-align:right; overflow-wrap:anywhere; }
.receipt-tagline { font-size:8px; margin:5px 0 0; }
th,td { padding-top:5px; padding-bottom:5px; }
.grand { font-size:14px; }
@media (min-width:100mm) {
 .receipt-header { padding-top:12pt; }
 .receipt-monogram { width:52pt; height:52pt; margin-bottom:8pt; font-size:30pt; }
 h1 { font-size:21pt; margin-bottom:5pt; }
 .receipt-meta-grid { margin-top:14pt; gap:20pt; font-size:10pt; line-height:1.65; }
 .receipt-tagline { font-size:8pt; }
 .receipt-address { font-size:10pt; margin:5pt 0 10pt; }
 .receipt-issued .receipt-label { font-size:18pt; margin-bottom:8pt; }
 th,td { padding-top:7pt; padding-bottom:7pt; }
 .totals .grand { font-size:15pt; padding:9pt 8pt !important; }
 .footer { margin-top:18pt; }
}
.receipt-label, .receipt-tagline, .unit, .qty, .summary { color:#000; font-weight:700; }
.receipt-location { color:#182620; }
.receipt-location strong, .receipt-issued strong { color:#182620; font-weight:400; }
.receipt-issued > div:not(.receipt-label), .receipt-tagline, .receipt-items td:first-child, .receipt-items td.unit-price, .receipt-items td.qty, .receipt-items td.total, .summary { color:#182620; font-weight:400; }
@media print { .no-print {display:none;} }
`;
