const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../../../dist');
const file = path.join(root, 'assets/TablesPage-0EcUUzMu.js');
let code = fs.readFileSync(file, 'utf8');
if (!code.includes('import{TableBoardActions}')) {
  const from = 'group.zone?.id??"unknown"))]}),c.jsx("div",{className:"table-cards-panel"';
  const to = 'group.zone?.id??"unknown")),c.jsx(TableBoardActions,{restaurantId:r,tables:l,zones:d,canAct:e,request:te,onTransferred:(source,target)=>f(current=>current.map(table=>table.id===source?{...table,is_open:false}:table.id===target?{...table,is_open:true}:table)),makeQR:zt,tableURL:table=>Dt(v,table),onDownload:Vt})]}),c.jsx("div",{className:"table-cards-panel"';
  if (!code.includes(from)) throw Error('Missing action insertion target');
  code = 'import{TableBoardActions}from"./table-board-actions.js";\n' + code.replace(from, to);
  fs.writeFileSync(file, code);
}
