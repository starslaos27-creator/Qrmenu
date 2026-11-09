const fs = require("node:fs");
const path = require("node:path");

const assets = path.resolve(__dirname, "../../../dist/assets");
const inputFile = path.join(assets, "menu-barcode-input.js");
let inputSource = fs.readFileSync(inputFile, "utf8");

const inputReplacements = [
  [
    "import {r as React, j as jsx} from './vendor-react-DCUvmuBu.js';\n\nexport function MenuBarcodeInput({value, setValue, setQuantity, inputClass}) {",
    "import {r as React, j as jsx} from './vendor-react-DCUvmuBu.js';\nimport {openBarcodeLabels} from './menu-barcode-labels.js';\n\nexport function MenuBarcodeInput({value, setValue, setQuantity, inputClass, menuName, stockQuantity}) {",
  ],
  [
    "export function MenuBarcodeInput({value, setValue, setQuantity, inputClass}) {",
    "export function MenuBarcodeInput({value, setValue, setQuantity, inputClass, menuName, stockQuantity}) {",
  ],
  [
    "value ? jsx.jsx('button', {type:'button', className:'menu-barcode-add-one',\n      style:{marginLeft:6}, onClick:() => {lockedCode.current='';dirty.current=false;setValue('');setDraft('');setError('');input.current?.focus();},\n      children:'เปลี่ยนรหัส'}) : null,",
    "value ? jsx.jsx('button', {type:'button', className:'menu-barcode-add-one menu-barcode-view-print',\n      style:{marginLeft:6}, onClick:event => {\n        event.preventDefault(); event.stopPropagation();\n        openBarcodeLabels({name:menuName?.trim() || value, stock_barcode:value,\n          stock_quantity:Number(stockQuantity) || 0, track_stock:true});\n      }, children:'ดู / พิมพ์ Barcode / Serial'}) : null,",
  ],
];

for (const [before, after] of inputReplacements) {
  if (!inputSource.includes(before)) {
    if (inputSource.includes(after)) continue;
    throw new Error(`Missing barcode input anchor: ${before.slice(0, 80)}`);
  }
  inputSource = inputSource.replace(before, after);
}
fs.writeFileSync(inputFile, inputSource);

const bundle = path.join(assets, "MenuPage-edit-20261106-v11.js");
let source = fs.readFileSync(bundle, "utf8");

const replacements = [
  [
    "MenuBarcodeInput,{value:stockBarcode,setValue:setStockBarcode,setQuantity:setStockQuantity,inputClass:L}",
    "MenuBarcodeInput,{value:stockBarcode,setValue:setStockBarcode,setQuantity:setStockQuantity,inputClass:L,menuName:S.trim()||C.trim()||g.trim(),stockQuantity}",
  ],
  [
    "MenuBarcodeInput,{value:b,setValue:setB,setQuantity:setQ,inputClass:L}",
    "MenuBarcodeInput,{value:b,setValue:setB,setQuantity:setQ,inputClass:L,menuName:o.name,stockQuantity:q}",
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) {
    if (source.includes(after)) continue;
    throw new Error(`Missing menu form anchor: ${before}`);
  }
  source = source.replace(before, after);
}

fs.writeFileSync(bundle, source);
console.log("Barcode view/print action is connected to both menu forms.");
