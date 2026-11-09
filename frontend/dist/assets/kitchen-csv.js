const labels={new:'รอรับออเดอร์',cooking:'กำลังทำ',ready:'พร้อมเสิร์ฟ',served:'เสิร์ฟแล้ว',cancelled:'ยกเลิกแล้ว'};
export const csvStage=order=>['served','cancelled'].includes(order.status)?'history':order.status==='ready'?'ready':order.accepted_at?'cooking':'new';
const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'};
export function kitchenCsv({orders,history,stage,tableMap,zoneMap,menuMap,nameOf}) {
  const rows=[['เลขที่ออเดอร์','วันที่สั่ง','โต๊ะ','โซน','สถานะ','รายการอาหาร','จำนวน','หมายเหตุ']];
  for(const order of [...orders,...history].filter(order=>stage==='all'||csvStage(order)===stage)) {
    const table=tableMap.get(order.table_id),zone=zoneMap.get(table?.zone_id);
    for(const item of order.items??[])rows.push([order.receipt_number||order.id,new Date(order.created_at).toLocaleString('th-TH',{timeZone:'Asia/Vientiane'}),table?.table_number??'',zone?.name??'',labels[order.status==='served'||order.status==='cancelled'?order.status:csvStage(order)],menuMap.has(item.menu_id)?nameOf(menuMap.get(item.menu_id)):item.menu_id,item.qty,item.note]);
  }
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function downloadKitchenCsv(data,range) {
  const url=URL.createObjectURL(new Blob([kitchenCsv(data)],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');link.href=url;link.download=`kitchen-${range?range.from+'_'+range.to:'live'}.csv`;
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
