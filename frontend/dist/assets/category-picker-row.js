import {r as React,j as jsx} from './vendor-react-DCUvmuBu.js';

export function CategoryPickerRow({category,label,selected,onSelect,onEdit,onDelete}) {
  const [mode,setMode] = React.useState(null);
  const [name,setName] = React.useState(label);
  const [busy,setBusy] = React.useState(false);
  const [error,setError] = React.useState('');
  async function save() {
    if (busy || (mode === 'edit' && !name.trim())) return;
    setBusy(true); setError('');
    try {
      if (mode === 'edit') await onEdit(category,name.trim());
      else await onDelete(category);
      setMode(null);
    } catch { setError('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  }
  function icon(action,title,path) {
    return jsx.jsx('button',{type:'button',title,'aria-label':`${title} ${label}`,className:'category-picker-icon '+action,onClick:()=>{setName(label);setError('');setMode(action);},children:jsx.jsx('svg',{viewBox:'0 0 24 24',width:17,height:17,fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true,children:jsx.jsx('path',{d:path,strokeLinecap:'round',strokeLinejoin:'round'})})});
  }
  return jsx.jsxs('li',{className:'category-picker-row',children:[
    jsx.jsxs('div',{className:'category-picker-line',children:[
      jsx.jsxs('button',{type:'button',className:'category-picker-select','aria-pressed':selected,onClick:()=>onSelect(category.id),children:[jsx.jsx('span',{children:label}),selected?jsx.jsx('span',{children:'✓'}):null]}),
      onEdit?icon('edit','แก้ไขหมวดหมู่','M16 3l5 5M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16z'):null,
      onDelete?icon('delete','ลบหมวดหมู่','M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'):null
    ]}),
    mode?jsx.jsxs('div',{className:'category-picker-editor',children:[
      mode==='edit'?jsx.jsx('input',{value:name,autoFocus:true,disabled:busy,'aria-label':'ชื่อหมวดหมู่',onChange:event=>setName(event.target.value),onKeyDown:event=>{if(event.key==='Enter'){event.preventDefault();save();}if(event.key==='Escape'){event.stopPropagation();setMode(null);}}}):jsx.jsx('p',{children:`ลบหมวดหมู่ “${label}”? เมนูอาหารจะยังอยู่และย้ายไปไม่มีหมวดหมู่`}),
      error?jsx.jsx('p',{role:'alert',className:'category-picker-error',children:error}):null,
      jsx.jsxs('div',{className:'category-picker-actions',children:[jsx.jsx('button',{type:'button',disabled:busy,onClick:()=>setMode(null),children:'ยกเลิก'}),jsx.jsx('button',{type:'button',disabled:busy||(mode==='edit'&&!name.trim()),onClick:save,children:busy?'กำลังบันทึก…':mode==='edit'?'บันทึก':'ยืนยันลบ'})]})
    ]}):null
  ]});
}
