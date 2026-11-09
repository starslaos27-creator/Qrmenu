import {r as React,j as jsx} from './vendor-react-DCUvmuBu.js';
import {e as request,u as useLocale,c as useToast} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';

export function KitchenPaperSettings({restaurantId,width,onSaved,canManage}) {
  const {t}=useLocale(),toast=useToast();
  const [selected,setSelected]=React.useState(String(width));
  const [saving,setSaving]=React.useState(false);
  React.useEffect(()=>setSelected(String(width)),[width]);
  async function save(event){
    event.preventDefault();
    if(!canManage||saving)return;
    const value=Number(selected);
    if(![58,76,80].includes(value))return;
    setSaving(true);
    try{
      await request(`/api/restaurants/${restaurantId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({kitchen_print_width:value})});
      onSaved(value);
      toast.success(t('set.shop.saved'));
    }catch(error){toast.error(t('set.shop.error.save',{error:error.code||'REQUEST_FAILED'}))}
    finally{setSaving(false)}
  }
  return jsx.jsxs('form',{onSubmit:save,className:'rounded-2xl border border-line bg-surface p-5 space-y-4',style:{marginTop:12},children:[
    jsx.jsxs('label',{className:'block',children:[
      jsx.jsx('span',{className:'mb-1.5 block text-xs font-semibold text-ink',children:t('set.shop.kitchen_print_width')}),
      jsx.jsx('select',{value:selected,onChange:event=>setSelected(event.target.value),disabled:!canManage||saving,className:'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm',children:[58,76,80].map(value=>jsx.jsx('option',{value:String(value),children:`${value} mm — ${t('set.shop.kitchen_width.'+value)}`},value))}),
      jsx.jsx('span',{className:'mt-1 block text-xs text-muted',children:t('set.shop.kitchen_print_width.hint')})
    ]}),
    canManage?jsx.jsx('button',{type:'submit',disabled:saving,className:'w-full rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50',children:saving?t('common.saving'):t('common.save')}):null
  ]});
}
