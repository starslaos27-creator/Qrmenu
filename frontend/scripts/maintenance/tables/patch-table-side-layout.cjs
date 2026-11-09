const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../../../dist');
const file = path.join(root, 'assets/TablesPage-0EcUUzMu.js');
let code = fs.readFileSync(file, 'utf8');
function replace(from, to) {
  if (!code.includes(from)) throw new Error('Missing target: ' + from.slice(0, 100));
  code = code.replace(from, to);
}
if (!code.includes('table-side-panel')) {
  replace('className:"table-board space-y-5"', 'className:"table-board table-side-layout"');
  replace('className:"table-tile-grid",children:u.tables.map(_=>c.jsx(TableTile,', 'className:"table-card-grid",children:u.tables.map(_=>c.jsx(_n,');
  replace('c.jsx("div",{children:l.length===0?', `c.jsxs("aside",{className:"table-side-panel",children:[c.jsx(fe,{title:o("mgr.tbl.list_title"),description:o("mgr.tbl.list_count",{n:U.length})}),...K.map(group=>c.jsxs("section",{className:"table-side-zone",children:[c.jsx("h3",{children:group.zone?.name??o("mgr.tbl.zone.unknown")}),c.jsx("div",{className:"table-tile-grid",children:group.tables.map(table=>c.jsx(TableTile,{table},table.id))})]},group.zone?.id??"unknown"))]}),c.jsx("div",{className:"table-cards-panel",children:l.length===0?`);
  replace('className:`rounded-2xl border bg-surface p-4 transition ${r.is_open?', 'id:"table-card-"+r.id,tabIndex:-1,className:`table-detail-card rounded-2xl border bg-surface p-4 transition ${r.is_open?');
  const start = code.indexOf('\nfunction TableTile(props)');
  if (start < 0) throw new Error('Missing tile component');
  code = code.slice(0, start) + `
function TableTile({table}) {
  const {t} = Qe();
  const status = t(table.is_open ? "mgr.tbl.open_badge" : "mgr.tbl.closed_badge");
  return c.jsxs("button", {type:"button", className:"table-tile " + (table.is_open ? "is-open" : "is-closed"), "aria-label":t("mgr.tbl.label",{n:table.table_number}) + " · " + status, onClick:()=>{
    const card = document.getElementById("table-card-" + table.id);
    if(card){card.scrollIntoView({behavior:"smooth",block:"center"});card.focus({preventScroll:true});}
  }, children:[c.jsx("span",{className:"table-tile-number",children:String(table.table_number).padStart(2,"0")}),c.jsx("span",{className:"table-tile-status",children:status})]});
}
`;
  fs.writeFileSync(file, code);
}
const htmlPath = path.join(root,'index.html');
fs.writeFileSync(htmlPath,fs.readFileSync(htmlPath,'utf8').replace('table-board.css?v=20260921"','table-board.css?v=20260921-side"'));
