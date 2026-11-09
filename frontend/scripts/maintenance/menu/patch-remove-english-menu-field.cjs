// Removes the English-name input from the compiled add-menu form.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../../../dist/assets/MenuPage-N38LKJ6t.js');
let text = fs.readFileSync(file, 'utf8');
const formStart = text.indexOf('e.jsxs("form",{id:"menu-add-form"');
const fieldStart = text.indexOf('e.jsx($,{label:t("mgr.menu.name_en")', formStart);
const nextField = text.indexOf('e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2"', fieldStart);
if (formStart < 0 || fieldStart < 0 || nextField < 0) {
  throw new Error('English name field anchors not found');
}
text = text.slice(0, fieldStart) + text.slice(nextField);
fs.writeFileSync(file, text);
console.log('English menu-name field removed.');
