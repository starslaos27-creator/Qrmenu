// Moves the existing CSV import panel into the top of the active legacy add-menu form.
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '../../../dist/assets/MenuPage-visible-20260913.js');
let source = fs.readFileSync(file, 'utf8');
const panelStart = 'e.jsxs("div",{className:`${_e} ${we} space-y-4 rounded-2xl border border-line/60 bg-surface shadow-sm`,children:[';
const formStart = 'e.jsxs("form",{id:"menu-add-form"';
const panelAt = source.indexOf(panelStart);
const formAt = source.indexOf(formStart, panelAt);
if (panelAt < 0 || formAt < 0) throw new Error('CSV panel or add-menu form anchor not found');

const panelWithComma = source.slice(panelAt, formAt);
if (!panelWithComma.endsWith(',')) throw new Error('Unexpected CSV panel boundary');
const panel = panelWithComma.slice(0, -1);
source = source.slice(0, panelAt) + 'null,' + source.slice(formAt);

const formChildren = 'children:[e.jsx("div",{className:"border-b border-line pb-4 mb-2"';
const childrenAt = source.indexOf(formChildren, panelAt);
if (childrenAt < 0) throw new Error('Add-menu form children anchor not found');
source = source.slice(0, childrenAt) + `children:[${panel},e.jsx("div",{className:"border-b border-line pb-4 mb-2"` + source.slice(childrenAt + formChildren.length);

fs.writeFileSync(file, source);
console.log('CSV import panel moved into the top of the add-menu form.');
