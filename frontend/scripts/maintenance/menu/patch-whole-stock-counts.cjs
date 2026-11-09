const fs = require("node:fs");
const path = require("node:path");

const bundle = path.resolve(__dirname, "../../../dist/assets/MenuPage-edit-20261106-v11.js");
let source = fs.readFileSync(bundle, "utf8");

const replacements = [
  [
    '[q,setQ]=l.useState(String(o.stock_quantity??""))',
    '[q,setQ]=l.useState(String(Math.max(0,Math.trunc(Number(o.stock_quantity)||0))))',
  ],
  [
    '[h,setH]=l.useState(String(o.low_alert_limit??""))',
    '[h,setH]=l.useState(String(Math.max(0,Math.trunc(Number(o.low_alert_limit)||0))))',
  ],
  [
    'type:"number",min:"0",className:L,value:q,onChange:x=>setQ(x.target.value)',
    'type:"number",min:"0",step:"1",className:L,value:q,onChange:x=>setQ(x.target.value.split(/[.,]/,1)[0].replace(/\\D/g,""))',
  ],
  [
    'type:"number",min:"0",className:L,value:h,onChange:x=>setH(x.target.value)',
    'type:"number",min:"0",step:"1",className:L,value:h,onChange:x=>setH(x.target.value.split(/[.,]/,1)[0].replace(/\\D/g,""))',
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) {
    if (source.includes(after)) continue;
    throw new Error(`Missing bundle anchor: ${before}`);
  }
  source = source.replace(before, after);
}

fs.writeFileSync(bundle, source);
console.log("Menu stock quantity fields now use whole numbers.");
