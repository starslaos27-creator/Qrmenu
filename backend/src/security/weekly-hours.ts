const time = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minute = (value) => Number(value.slice(0,2))*60+Number(value.slice(3));
export function validateWeeklyHours(input) {
  if (!input || typeof input.enabled!=="boolean" || !Array.isArray(input.days) || input.days.length!==7) return false;
  const intervals: number[][]=[];
  for(let day=0;day<7;day++) {
    const row=input.days[day];
    if(!row || row.day!==day || typeof row.enabled!=="boolean" || !Array.isArray(row.slots) || row.slots.length!==4) return false;
    for(const slot of row.slots) {
      if(!slot || typeof slot.enabled!=="boolean" || !time(slot.start) || !time(slot.end)) return false;
      if(!slot.enabled)continue;
      if(slot.start===slot.end)return false;
      if(!row.enabled)continue;
      const start=day*1440+minute(slot.start);
      let end=day*1440+minute(slot.end);if(end<start)end+=1440;
      if(end>10080){intervals.push([start,10080],[0,end-10080]);}else intervals.push([start,end]);
    }
  }
  intervals.sort((a,b)=>a[0]-b[0]);
  return intervals.every((slot,index)=>index===0||slot[0]>=intervals[index-1][1]);
}
export function isWithinWeeklyHours(schedule, now = new Date()) {
  if(!schedule?.enabled)return true;
  if(!validateWeeklyHours(schedule))return false;
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Bangkok",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const get=(type)=>parts.find(p=>p.type===type)?.value;
  const day=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(get("weekday")||"");
  const current=day*1440+Number(get("hour"))*60+Number(get("minute"));
  return schedule.days.some(row=>row.enabled&&row.slots.some(slot=>{
    if(!slot.enabled)return false;
    const start=row.day*1440+minute(slot.start);let end=row.day*1440+minute(slot.end);if(end<start)end+=1440;
    return (current>=start&&current<end)||(end>10080&&current<end-10080);
  }));
}
