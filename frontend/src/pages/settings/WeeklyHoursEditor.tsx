import {useEffect,useState} from "react";
import {loadRestaurantSession} from "../../features/auth/session";
import {apiRequest,ApiError} from "../../shared/api/client";
interface Slot {enabled:boolean;start:string;end:string}
interface Schedule {enabled:boolean;days:{day:number;enabled:boolean;slots:Slot[]}[]}
interface Response {schedule:Schedule|null;version:number;open_time?:string|null;close_time?:string|null;canManage?:boolean}
const days=["วันจันทร์","วันอังคาร","วันพุธ","วันพฤหัสบดี","วันศุกร์","วันเสาร์","วันอาทิตย์"];
function initial(open?:string|null,close?:string|null):Schedule {
  const old=!!open&&!!close&&open!==close;
  return {enabled:false,days:days.map((_,day)=>({day,enabled:old,slots:[
    {enabled:old,start:old?open!.slice(0,5):"08:00",end:old?close!.slice(0,5):"12:00"},
    {enabled:false,start:"13:00",end:"17:00"},{enabled:false,start:"18:00",end:"21:00"},{enabled:false,start:"21:00",end:"23:00"},
  ]}))};
}
export default function WeeklyHoursEditor({restaurantId}:{restaurantId?:string}) {
  const [id,setId]=useState(restaurantId||"");
  const [schedule,setSchedule]=useState<Schedule>(initial());
  const [version,setVersion]=useState(0);
  const [canManage,setCanManage]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const resolved=restaurantId||(await loadRestaurantSession()).membership?.restaurant_id;
        if(!resolved)throw Error("NO_RESTAURANT");
        const data=await apiRequest<Response>(`/api/restaurants/${resolved}/weekly-hours`);
        if(active){setId(resolved);setSchedule(data.schedule||initial(data.open_time,data.close_time));setVersion(data.version);setCanManage(!!data.canManage);}
      }catch{if(active)setError("โหลดเวลาเปิด–ปิดไม่สำเร็จ กรุณาโหลดหน้าใหม่");}finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[restaurantId]);
  function update(day:number,slot:number|null,patch:Partial<Slot>|{enabled:boolean}) {
    setSchedule(old=>({...old,days:old.days.map((row,index)=>index!==day?row:slot===null?{...row,...patch}: {...row,slots:row.slots.map((value,i)=>i===slot?{...value,...patch}:value)})}));setNotice("");
  }
  async function save() {
    if(busy||!canManage)return;
    if(schedule.days.some(row=>row.slots.some(slot=>slot.enabled&&(!slot.start||!slot.end||slot.start===slot.end)))) {setError("กรุณาระบุเวลาเปิดและปิดให้ต่างกันทุกช่วงที่เปิดใช้งาน");return;}
    setBusy(true);setError("");setNotice("");
    try{const result=await apiRequest<Response>(`/api/restaurants/${id}/weekly-hours`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({schedule,version})});setVersion(result.version);setNotice("บันทึกตารางเวลาแล้ว");}
    catch(cause){setError(cause instanceof ApiError&&cause.code==="SCHEDULE_CHANGED"?"ตารางถูกแก้ไขจากอีกหน้าหนึ่ง กรุณาโหลดใหม่ก่อนบันทึก":cause instanceof ApiError&&cause.code==="INVALID_WEEKLY_HOURS"?"เวลาไม่ถูกต้องหรือมีช่วงเวลาซ้อนกัน กรุณาตรวจสอบทั้ง 7 วัน รวมช่วงข้ามเที่ยงคืน":"บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");}finally{setBusy(false);}
  }
  const disabled=!canManage||busy||loading;
  return <div className="weekly-hours-editor">
    <link rel="stylesheet" href="/weekly-hours.css?v=20261024" />
    <div className="wh-heading"><div><h3>เวลาเปิด–ปิดรายสัปดาห์</h3><p>7 วัน · วันละ 4 ช่วงเวลา · เวลาไทย/ลาว (UTC+7)</p></div><label className="wh-master"><input type="checkbox" role="switch" checked={schedule.enabled} disabled={disabled} onChange={event=>{setSchedule(old=>({...old,enabled:event.target.checked}));setNotice("");}} />ใช้ตารางอัตโนมัติ</label></div>
    {loading?<p role="status">กำลังโหลดตารางเวลา…</p>:<>
      <p className="wh-help">{schedule.enabled?"รับออเดอร์เฉพาะช่วงที่เปิดไว้ หากปิดสวิตช์รับออเดอร์หลัก ร้านจะหยุดรับทันที":"ตารางอัตโนมัติปิดอยู่ ร้านใช้สวิตช์รับออเดอร์หลักตามเดิม"}</p>
      <div className="wh-scroll"><table><thead><tr><th scope="col">วัน / เปิดใช้งาน</th>{[1,2,3,4].map(value=><th key={value} scope="col">ช่วงที่ {value}</th>)}</tr></thead><tbody>{schedule.days.map((row,day)=><tr key={day} className={row.enabled?"":"wh-day-off"}><th scope="row"><label className="wh-day"><input type="checkbox" role="switch" checked={row.enabled} disabled={disabled} onChange={event=>update(day,null,{enabled:event.target.checked})} />{days[day]}</label><small>{row.enabled&&row.slots.some(slot=>slot.enabled)?"ตั้งช่วงเวลาได้":"หยุดรับออเดอร์"}</small></th>{row.slots.map((slot,index)=><td key={index}><label className="wh-slot-toggle"><input type="checkbox" role="switch" checked={slot.enabled} disabled={disabled||!row.enabled} aria-label={`${days[day]} ช่วงที่ ${index+1} เปิดใช้งาน`} onChange={event=>update(day,index,{enabled:event.target.checked})} />{slot.enabled?"เปิดช่วงนี้":"ปิดช่วงนี้"}</label><div className="wh-times"><input type="time" value={slot.start} disabled={disabled||!row.enabled||!slot.enabled} aria-label={`${days[day]} เวลาเปิดช่วงที่ ${index+1}`} onChange={event=>update(day,index,{start:event.target.value})} /><span>–</span><input type="time" value={slot.end} disabled={disabled||!row.enabled||!slot.enabled} aria-label={`${days[day]} เวลาปิดช่วงที่ ${index+1}`} onChange={event=>update(day,index,{end:event.target.value})} /></div>{slot.enabled&&slot.end<slot.start&&<small className="wh-next-day">ปิดวันถัดไป</small>}</td>)}</tr>)}</tbody></table></div>
      <div className="wh-footer"><p>เวลาปิดก่อนเวลาเปิด = ข้ามเที่ยงคืน · ห้ามช่วงเวลาซ้อนกัน<br />เปิด/ปิดสวิตช์แล้วกดบันทึกตารางเวลา</p><button type="button" onClick={()=>void save()} disabled={disabled}>{busy?"กำลังบันทึก…":"บันทึกตารางเวลา"}</button></div>
      {!canManage&&!error&&<p className="wh-help">แก้ไขตารางเวลาได้เฉพาะเจ้าของร้าน</p>}
    </>}
    {error&&<p role="alert" className="wh-error">{error}</p>}{notice&&<p role="status" className="wh-success">{notice}</p>}
  </div>;
}
