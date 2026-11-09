const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../../../dist');
const file = path.join(root, 'assets/TablesPage-0EcUUzMu.js');
let code = fs.readFileSync(file, 'utf8');
function replace(from, to) {
  if (!code.includes(from)) throw new Error('Missing patch target: ' + from.slice(0, 90));
  code = code.replace(from, to);
}
if (!code.includes('function TableTile(')) {
  replace('className:n?"grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]":"grid grid-cols-1 gap-5"', 'className:"table-board space-y-5"');
  replace('n?c.jsxs("div",{className:"space-y-4 lg:sticky lg:top-20 lg:h-fit",children:[', 'n?c.jsxs("details",{className:"table-create",children:[c.jsx("summary",{className:"table-create-button",children:"+ "+o("mgr.tbl.add_title")}),c.jsx("div",{className:"table-create-hint",children:o("mgr.tbl.zone.desc")}),');
  replace('className:"grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",children:u.tables.map(_=>c.jsx(_n,', 'className:"table-tile-grid",children:u.tables.map(_=>c.jsx(TableTile,');
  code += `
function TableTile(props) {
  const {t} = Qe();
  const modal = L.useRef(null);
  const table = props.table;
  const status = t(table.is_open ? "mgr.tbl.open_badge" : "mgr.tbl.closed_badge");
  const label = t("mgr.tbl.label", {n: table.table_number});
  return c.jsxs("div", {className: "table-tile-wrap", children: [
    c.jsxs("button", {type: "button", className: "table-tile " + (table.is_open ? "is-open" : "is-closed"), onClick: () => modal.current.showModal(), "aria-label": label + " · " + status, "aria-haspopup": "dialog", children: [
      c.jsx("span", {className: "table-tile-number", children: String(table.table_number).padStart(2, "0")}),
      c.jsx("span", {className: "table-tile-status", children: status})
    ]}),
    c.jsxs("dialog", {ref: modal, className: "table-detail-dialog", "aria-label": label, onClick: event => {if (event.target === event.currentTarget) modal.current.close();}, children: [
      c.jsxs("div", {className: "table-dialog-heading", children: [c.jsx("strong", {children: label + " · " + (props.zone?.name ?? t("mgr.tbl.zone.unknown"))}), c.jsx("button", {type: "button", autoFocus: true, onClick: () => modal.current.close(), children: t("common.close") + " ×"})]}),
      c.jsx(_n, props)
    ]})
  ]});
}
`;
  fs.writeFileSync(file, code);
}
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('/assets/table-board.css')) {
  html = html.replace('</head>', '  <link rel="stylesheet" href="/assets/table-board.css?v=20260921">\n  </head>');
  fs.writeFileSync(htmlPath, html);
}
