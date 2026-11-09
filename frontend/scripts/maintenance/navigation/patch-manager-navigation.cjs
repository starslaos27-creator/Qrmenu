// Compatibility patch for this compiled distribution. Fails if bundle anchors change.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../../../dist/assets');
const backup = path.join(__dirname, '../../../../.local/navigation-backup');
fs.mkdirSync(backup, {recursive:true});
function patch(file, edit) {
  const target=path.join(root,file), original=fs.readFileSync(target,'utf8');
  if (!fs.existsSync(path.join(backup,file))) fs.writeFileSync(path.join(backup,file),original);
  let text=original;
  const replace=(from,to)=>{if(!text.includes(from))throw Error(`${file}: missing anchor ${from.slice(0,80)}`);text=text.replace(from,to);};
  edit(replace,()=>text);
  fs.writeFileSync(target,text);
}
patch('index-BjXGGWCT.js',(replace,get)=>{
  replace('import{r as s', 'import{ManagerNavigation,NavigationView}from"./manager-navigation.js";import{r as s');
  replace('[c,i]=s.useState(()=>window.location.pathname)', '[c,i]=s.useState(()=>window.location.pathname+window.location.search)');
  replace('i(window.location.pathname),o(!1)', 'i(window.location.pathname+window.location.search),o(!1)');
  const text=get(),start=text.indexOf('children:e.jsx("ul",{className:"space-y-0.5",children:p.map('),end=text.indexOf('}),e.jsxs("div",{className:"space-y-2 border-t',start);
  if(start<0||end<0)throw Error('Navigation anchors missing');
  replace(text.slice(start,end),'children:e.jsx(ManagerNavigation,{role:t,navigate:f,current:c,existing:p,translate:n,badges:g})');
  replace('children:e.jsx(s.Suspense,{fallback:e.jsx(Z,{}),children:r.restaurant?', 'children:e.jsxs(s.Suspense,{key:window.location.pathname+window.location.search,fallback:e.jsx(Z,{}),children:[e.jsx(NavigationView,{}),r.restaurant?');
  replace('No restaurant data found. Please check the PostgreSQL migration and membership data."})})})', 'No restaurant data found. Please check the PostgreSQL migration and membership data."})]})})');
});
patch('InventoryPage-Dmd7-h3j.js',replace=>{
  replace('[h,_]=l.useState("items")','[h,_]=l.useState(()=>{const view=new URLSearchParams(location.search).get("view");return view==="recipes"&&v==="owner"?"recipes":view==="movements"?"movements":"items"})');
  replace('[g,H]=l.useState("all")','[g,H]=l.useState(()=>new URLSearchParams(location.search).get("view")==="low"?"low":"all")');
});
patch('MenuPage-N38LKJ6t.js',replace=>replace('"form",{onSubmit:Ie','"form",{id:"menu-add-form",onSubmit:Ie'));
patch('KitchenPage-BWBFK9t3.js',replace=>{
  replace('[P,L]=p.useState("active")','[P,L]=p.useState(()=>new URLSearchParams(location.search).get("view")==="served"?"history":"active")');
  replace('const n=S.filter(w=>w.status==="pending"||w.status==="ready")','const view=new URLSearchParams(location.search).get("view"),n=S.filter(w=>view==="ready"?w.status==="ready":["new","cooking"].includes(view)?w.status==="pending":w.status==="pending"||w.status==="ready")');
  replace('orders:$e,menuMap:M','orders:new URLSearchParams(location.search).get("view")==="served"?$e.filter(order=>order.status==="served"):$e,menuMap:M');
});
patch('StatsPage-BNP-vJp0.js',replace=>{
  replace('[h,S]=b.useState(null)','[h,S]=b.useState(()=>{const v=new URLSearchParams(location.search).get("view");return v==="today"?"today":v==="month"?"month":null})');
  replace('function P(a){return a==="today"?', 'function P(a){if(a==="month"){const d=new Date;d.setDate(1);return G(d).getTime()}return a==="today"?');
  replace('const ie={today:', 'const ie={month:"stats.month",today:');
});
console.log('Manager navigation patched. Original bundles saved in .local/navigation-backup.');
