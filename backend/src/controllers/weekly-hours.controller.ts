import {requireRestaurantAccess} from "../security/authorization.js";
import {validateWeeklyHours} from "../security/weekly-hours.js";

export function createWeeklyHoursController(app, env) {
  const path="/api/restaurants/:restaurantId/weekly-hours";
  async function access(request,reply,roles?) {
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.restaurantId||"")){reply.code(400).send({error:"INVALID_RESTAURANT"});return null;}
    return requireRestaurantAccess(request,reply,env,request.params.restaurantId,roles);
  }
  const handler1 = async(request,reply)=>{
    const auth=await access(request,reply);if(!auth)return;
    const row=(await app.db.query("select weekly_hours,weekly_hours_version,open_time,close_time from restaurants where id=$1",[auth.restaurantId])).rows[0];
    reply.header("Cache-Control","no-store");return {schedule:row.weekly_hours,version:row.weekly_hours_version,open_time:row.open_time,close_time:row.close_time,canManage:auth.role==="owner"};
  };
  const handler2 = async(request,reply)=>{
    const auth=await access(request,reply,["owner"]);if(!auth)return;
    const {schedule,version}=request.body||{};
    if(!Number.isSafeInteger(version)||version<0||!validateWeeklyHours(schedule))return reply.code(400).send({error:"INVALID_WEEKLY_HOURS"});
    const clean={enabled:schedule.enabled,days:schedule.days.map(row=>({day:row.day,enabled:row.enabled,slots:row.slots.map(slot=>({enabled:slot.enabled,start:slot.start,end:slot.end}))}))};
    const result=await app.db.query("update restaurants set weekly_hours=$2::jsonb,weekly_hours_version=weekly_hours_version+1,updated_at=now() where id=$1 and weekly_hours_version=$3 returning weekly_hours,weekly_hours_version",[auth.restaurantId,JSON.stringify(clean),version]);
    if(!result.rows[0])return reply.code(409).send({error:"SCHEDULE_CHANGED"});
    return {schedule:result.rows[0].weekly_hours,version:result.rows[0].weekly_hours_version};
  };
  return { path, handler1, handler2 };
}


