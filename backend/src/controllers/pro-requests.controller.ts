import { requireRestaurantAccess } from "../security/authorization.js";
import { getOrderFeeBillingState } from "../security/order-fee-billing.js";
import { requirePlatformAdmin } from "../admin/authorization.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const joins = `from pro_requests p join restaurants r on r.id=p.restaurant_id
  join app_users u on u.id=p.requested_by left join app_users a on a.id=p.reviewed_by`;
const columns = `p.*, r.name as restaurant_name, u.email as requester_email, a.email as reviewer_email`;

export function createProRequestController(app, env) {
  const validImage = (type, data) => type === "image/jpeg" ? data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) : type === "image/png" ? data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : type === "image/webp" && data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP";
  async function readImage(request, reply) {
    if (!request.isMultipart()) { reply.code(400).send({error:"IMAGE_REQUIRED"}); return null; }
    const part = await request.file({limits:{fileSize:5*1024*1024,files:1}});
    if (!part) { reply.code(400).send({error:"IMAGE_REQUIRED"}); return null; }
    let data;
    try { data = await part.toBuffer(); } catch { reply.code(413).send({error:"IMAGE_TOO_LARGE"}); return null; }
    if (part.file.truncated || !validImage(part.mimetype, data)) { reply.code(400).send({error:"INVALID_IMAGE"}); return null; }
    return {data, type:part.mimetype, fields:part.fields};
  }
  const get_api_pro_payment_qr = async (_request, reply) => {
    const row = (await app.db.query("select qr_url from pro_payment_settings where id=true")).rows[0];
    reply.header("Cache-Control", "no-store");
    return {qrUrl:row?.qr_url || null};
  };
  const put_api_admin_pro_payment_qr = async (request, reply) => {
    const admin = await requirePlatformAdmin(request, reply, env, ["super_admin", "support"]); if (!admin) return;
    if (env.imageStorageDriver !== "r2" || !env.r2AccountId || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2BucketName || !env.r2PublicBaseUrl) return reply.code(503).send({error:"STORAGE_NOT_CONFIGURED"});
    const image = await readImage(request, reply); if (!image) return;
    const key = `platform-pro-qr/${randomUUID()}.${image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg"}`;
    const client = new S3Client({region:"auto",endpoint:`https://${env.r2AccountId}.r2.cloudflarestorage.com`,credentials:{accessKeyId:env.r2AccessKeyId,secretAccessKey:env.r2SecretAccessKey}});
    await client.send(new PutObjectCommand({Bucket:env.r2BucketName,Key:key,Body:image.data,ContentType:image.type,CacheControl:"public, max-age=31536000, immutable"}));
    const qrUrl = `${env.r2PublicBaseUrl.replace(/\/+$/, "")}/${key}`;
    await app.db.query(`insert into pro_payment_settings(id,qr_url,updated_by) values(true,$1,$2) on conflict(id) do update set qr_url=excluded.qr_url,updated_by=excluded.updated_by,updated_at=now()`,[qrUrl,admin.user.id]);
    return {qrUrl};
  };
  const get_api_admin_pro_request_slip = async (request, reply) => {
    if (!await requirePlatformAdmin(request, reply, env)) return;
    if (!uuid(request.params.id)) return reply.code(400).send({error:"INVALID_REQUEST"});
    const row = (await app.db.query("select content_type,image_data from pro_payment_slips where pro_request_id=$1",[request.params.id])).rows[0];
    if (!row) return reply.code(404).send({error:"NOT_FOUND"});
    reply.header("Cache-Control","private, no-store");
    return {contentType:row.content_type, data:row.image_data.toString("base64")};
  };
  const get_api_admin_pro_request_count = async (request, reply) => {
    if (!await requirePlatformAdmin(request, reply, env)) return;
    const row = (await app.db.query("select count(*)::int as count from pro_requests where status='pending'")).rows[0];
    reply.header("Cache-Control","no-store"); return row;
  };
  async function readPricing(reply) {
    if (!app.db) return reply.code(503).send({error:"DATABASE_NOT_CONFIGURED"});
    const result = await app.db.query("select monthly_usd,version,updated_at from pro_pricing where id=true");
    reply.header("Cache-Control","no-store");
    return result.rows[0];
  }
  const get_api_pro_pricing = async (request,reply) => readPricing(reply);
  const get_api_admin_pro_pricing = async (request,reply) => {
    if (!await requirePlatformAdmin(request,reply,env)) return;
    return readPricing(reply);
  };
  const put_api_admin_pro_pricing = async (request,reply) => {
    const admin=await requirePlatformAdmin(request,reply,env,["super_admin","support"]);if(!admin)return;
    const b=request.body||{};
    if(typeof b.monthlyUsd!=="string"||!/^\d{1,7}(\.\d{1,2})?$/.test(b.monthlyUsd)||Number(b.monthlyUsd)<=0||Number(b.monthlyUsd)>1000000||!Number.isSafeInteger(b.version)) return reply.code(400).send({error:"INVALID_PRICE"});
    const client=await app.db.connect();
    try {
      await client.query("begin");
      const previous=(await client.query("select * from pro_pricing where id=true for update")).rows[0];
      if(previous.version!==b.version){await client.query("rollback");return reply.code(409).send({error:"PRICE_CHANGED"});}
      const result=await client.query("update pro_pricing set monthly_usd=$1,version=version+1,updated_by=$2,updated_at=now() where id=true returning monthly_usd,version,updated_at",[b.monthlyUsd,admin.user.id]);
      await client.query(`insert into platform_admin_audit_logs(admin_user_id,action,target_type,details,ip_address)
        values($1,'pro_pricing.updated','pro_pricing',$2::jsonb,$3)`,[admin.user.id,JSON.stringify({previousMonthlyUsd:previous.monthly_usd,monthlyUsd:result.rows[0].monthly_usd,currency:"USD"}),request.ip]);
      await client.query("commit");return result.rows[0];
    }catch(error){await client.query("rollback");throw error;}finally{client.release();}
  };
  const get_api_restaurants_restaurantId_pro_countdown = async (request, reply) => {
    if (!uuid(request.params.restaurantId)) return reply.code(400).send({error:"INVALID_RESTAURANT"});
    if (!await requireRestaurantAccess(request, reply, env, request.params.restaurantId)) return;
    const result = await app.db.query(`with clock as (
        select clock_timestamp() as server_now
      ), paid as (
        select max(reviewed_at + (paid_months + free_months) * interval '30 days') as expires_at
        from pro_requests where restaurant_id=$1 and status='approved' and cancelled_at is null
      ), trial as (
        select starts_at, expires_at from restaurant_pro_trials where restaurant_id=$1
      )
      select greatest(paid.expires_at, trial.expires_at) as expires_at,
        clock.server_now,
        exists(select 1 from pro_requests where restaurant_id=$1 and status='pending') as pending,
        coalesce(trial.expires_at > clock.server_now and
          (paid.expires_at is null or trial.expires_at >= paid.expires_at), false) as trial_active
      from clock cross join paid left join trial on true`, [request.params.restaurantId]);
    reply.header("Cache-Control", "no-store");
    return result.rows[0];
  };
  async function owner(request, reply) {
    if (!uuid(request.params.restaurantId)) { reply.code(400).send({error:"INVALID_RESTAURANT"}); return null; }
    return requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner"]);
  }
  let exchangeRateCache: {rate:number; date:string; fetchedAt:string; expires:number} | null = null;
  async function loadExchangeRate() {
    if (exchangeRateCache && exchangeRateCache.expires > Date.now()) return {rate:exchangeRateCache.rate,date:exchangeRateCache.date,fetchedAt:exchangeRateCache.fetchedAt};
      const response=await fetch("https://www.bcel.com.la/bcel/exchange-rate.html?lang=en",{signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error("BCEL unavailable");
      const html=await response.text();
      const date=html.match(/Date:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
      const row=html.match(/<tr\b(?:(?!<\/tr>)[\s\S])*?USD\s*1-20\s*<\/td>(?:(?!<\/tr>)[\s\S])*?<\/tr>/i)?.[0];
      const rateText=row?.match(/<td\b[^>]*data-title=["']Sell Rates["'][^>]*>\s*([\d,.]+)\s*<\/td>/i)?.[1];
      const rate=Number(rateText?.replace(/,/g,""));
      if (!date || !Number.isFinite(rate) || rate <= 0) throw new Error("BCEL format changed");
      const fetchedAt=new Date().toISOString();
      exchangeRateCache={rate,date,fetchedAt,expires:Date.now()+10*60*1000};
      return {rate,date,fetchedAt};
  }
  const get_api_restaurants_restaurantId_pro_exchange_rate = async (request, reply) => {
    if (!await owner(request,reply)) return;
    reply.header("Cache-Control","private, no-store");
    try {
      return await loadExchangeRate();
    } catch {
      return reply.code(503).send({error:"EXCHANGE_RATE_UNAVAILABLE"});
    }
  };
  const get_admin_pro_exchange_rate = async (request,reply) => {
    if(!await requirePlatformAdmin(request,reply,env))return;
    reply.header("Cache-Control","private, no-store");
    try{return await loadExchangeRate();}catch{return reply.code(503).send({error:"EXCHANGE_RATE_UNAVAILABLE"});}
  };
  async function orderBillsSummary(request,reply,restaurantId) {
    const {from,to}=request.query || {};
    const offset=Number(request.query?.offset ?? 0);
    const validDate=(value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
    const cycleStartAt=request.query?.cycleStartAt, cycleCutoffAt=request.query?.cycleCutoffAt;
    const validTimestamp=(value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
    const hasCycle=validTimestamp(cycleStartAt) && validTimestamp(cycleCutoffAt) && cycleStartAt < cycleCutoffAt;
    if ((!hasCycle && (!validDate(from) || !validDate(to) || from > to || Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`) > 366*86400000)) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return reply.code(400).send({error:"INVALID_DATE_RANGE"});
    const restaurant=(await app.db.query("select currency_code from restaurants where id=$1",[restaurantId])).rows[0];
    if (restaurant?.currency_code !== "LAK") return reply.code(400).send({error:"LAK_REQUIRED"});
    const result=await app.db.query(`with bills as (
      select id, receipt_number, paid_at, bill_total,
        case when bill_total < 50000 then 0 when bill_total < 100000 then 200
          when bill_total < 250000 then 300 when bill_total < 400000 then 400
          when bill_total < 1000000 then 500 when bill_total < 1500000 then 1000
          when bill_total < 2500000 then 1250 else 1450 end as fee
      from bill_payment_details where restaurant_id=$1 and reopened_at is null
      and not exists (select 1 from order_fee_request_bills link join order_fee_requests paid on paid.id=link.request_id where link.bill_id=bill_payment_details.id and paid.status in ('approved','pending') and paid.is_test=$5)
      and case when $6::timestamptz is not null then paid_at < $7::timestamptz
        else paid_at >= ($2::date::timestamp at time zone 'Asia/Vientiane') and paid_at < (($3::date + 1)::timestamp at time zone 'Asia/Vientiane') end
    ) select receipt_number, paid_at, bill_total::text, fee,
      count(*) over()::int as total_count, sum(bill_total) over()::text as total_amount,
      sum(fee) over()::text as total_fee
      from bills order by paid_at desc, id desc limit 1000 offset $4`, [restaurantId,from || null,to || null,offset,orderFeeTestMode,hasCycle?cycleStartAt:null,hasCycle?cycleCutoffAt:null]);
    reply.header("Cache-Control","private, no-store");
    const billing=await getOrderFeeBillingState(app.db,restaurantId,orderFeeTestMode);
    return {bills:result.rows.map(({total_count,total_amount,total_fee,...bill})=>bill),count:result.rows[0]?.total_count ?? 0,total:result.rows[0]?.total_amount ?? "0",totalFee:result.rows[0]?.total_fee ?? "0",testMode:orderFeeTestMode,billing};
  }
  const get_api_restaurants_restaurantId_pro_order_bills = async (request, reply) => {
    const auth=await owner(request,reply); if(!auth)return;
    return orderBillsSummary(request,reply,auth.restaurantId);
  };
  const get_admin_order_bills_summary = async (request,reply) => {
    if(!await requirePlatformAdmin(request,reply,env))return;
    if(!uuid(request.params.restaurantId))return reply.code(400).send({error:"INVALID_RESTAURANT"});
    return orderBillsSummary(request,reply,request.params.restaurantId);
  };
  const orderFeeTestMode = env.nodeEnv !== "production" && process.env.ORDER_FEE_TEST_MODE === "true" && (()=>{try{return ["127.0.0.1","localhost","::1","[::1]"].includes(new URL(env.databaseUrl).hostname);}catch{return false;}})();
  async function orderFeeSnapshot(client, restaurantId, cycleStartAt, cycleCutoffAt, test, requestId=null) {
    return (await client.query(`select count(*)::int as bill_count,
      coalesce(sum(case when bill_total < 50000 then 0 when bill_total < 100000 then 200 when bill_total < 250000 then 300 when bill_total < 400000 then 400 when bill_total < 1000000 then 500 when bill_total < 1500000 then 1000 when bill_total < 2500000 then 1250 else 1450 end),0)::text as fee_lak,
      md5(coalesce(string_agg(id::text || ':' || bill_total::text || ':' || extract(epoch from paid_at)::text, ',' order by id),'')) as fingerprint
      from bill_payment_details b where restaurant_id=$1 and reopened_at is null
      and (case when $5::uuid is not null then exists (select 1 from order_fee_request_bills l where l.bill_id=b.id and l.request_id=$5) else not exists (select 1 from order_fee_request_bills l join order_fee_requests r on r.id=l.request_id where l.bill_id=b.id and r.status in ('approved','pending') and r.is_test=$4) end)
      and (case when $4 then paid_at >= $2::timestamptz else true end) and paid_at < $3::timestamptz`,[restaurantId,cycleStartAt,cycleCutoffAt,test,requestId])).rows[0];
  }
  const get_order_fee_requests = async (request,reply) => {
    const auth=await owner(request,reply); if(!auth)return;
    const result=await app.db.query("select id, month_start::text, period_end::text, cycle_start_at, cycle_cutoff_at, is_test, bill_count, fee_lak, rate_lak, amount_usd, status, created_at, review_note from order_fee_requests where restaurant_id=$1 order by created_at desc limit 50",[auth.restaurantId]);
    const billing=await getOrderFeeBillingState(app.db,auth.restaurantId,orderFeeTestMode);
    reply.header("Cache-Control","private, no-store"); return {requests:result.rows,testMode:orderFeeTestMode,billing};
  };
  const get_order_fee_billing_status = async (request,reply) => {
    const auth=await requireRestaurantAccess(request,reply,env,request.params.restaurantId);if(!auth)return;
    const billing=await getOrderFeeBillingState(app.db,auth.restaurantId,orderFeeTestMode);
    reply.header("Cache-Control","private, no-store");return {billing};
  };
  async function submitOrderFeeRequest(request,reply,auth,isAdmin) {
    const image=await readImage(request,reply); if(!image)return;
    const field=(name)=>image.fields[name]?.value;
    const month=field("month"), end=field("end"), test=field("test")==="true", key=field("requestKey"), expectedFee=field("feeLak"), expectedRate=field("rateLak");
    const cycleStartAt=field("cycleStartAt"), cycleCutoffAt=field("cycleCutoffAt");
    if (!uuid(key) || typeof month!=="string" || !/^\d{4}-\d{2}-01$/.test(month) || Number.isNaN(Date.parse(`${month}T00:00:00Z`)) || new Date(`${month}T00:00:00Z`).toISOString().slice(0,10)!==month || !/^\d+(\.\d{1,2})?$/.test(expectedFee || "") || !/^\d+(\.\d{1,2})?$/.test(expectedRate || "")) return reply.code(400).send({error:"INVALID_REQUEST"});
    if (typeof end!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(end) || Number.isNaN(Date.parse(`${end}T00:00:00Z`)) || new Date(`${end}T00:00:00Z`).toISOString().slice(0,10)!==end || typeof cycleStartAt!=="string" || typeof cycleCutoffAt!=="string" || Number.isNaN(Date.parse(cycleStartAt)) || Number.isNaN(Date.parse(cycleCutoffAt)) || new Date(cycleStartAt).toISOString()!==cycleStartAt || new Date(cycleCutoffAt).toISOString()!==cycleCutoffAt || cycleStartAt>=cycleCutoffAt || (test && !orderFeeTestMode)) return reply.code(400).send({error:"INVALID_REQUEST"});
    let rate; try { rate=(await loadExchangeRate()).rate+287; } catch { return reply.code(503).send({error:"EXCHANGE_RATE_UNAVAILABLE"}); }
    const client=await app.db.connect();
    try {
      await client.query("begin");
      // Serialize order-fee submissions with Pro package purchases so the two billing modes cannot overlap.
      await client.query("select pg_advisory_xact_lock(hashtext($1))",[`pro:${auth.restaurantId}`]);
      const existing=(await client.query("select *,month_start::text as month_text from order_fee_requests where request_key=$1",[key])).rows[0];
      if(existing){await client.query("rollback"); if(existing.restaurant_id!==auth.restaurantId || existing.requested_by!==auth.user.id || existing.month_text!==month || existing.is_test!==test) return reply.code(409).send({error:"REQUEST_CONFLICT"}); return {request:{id:existing.id,status:existing.status}};}
      const activePro=(await client.query(`select max(reviewed_at + (paid_months + free_months) * interval '30 days') as expires_at
        from pro_requests where restaurant_id=$1 and status='approved' and cancelled_at is null
        having max(reviewed_at + (paid_months + free_months) * interval '30 days') > clock_timestamp()`,[auth.restaurantId])).rows[0];
      if(activePro){await client.query("rollback");return reply.code(409).send({error:"PRO_ACTIVE",expiresAt:activePro.expires_at});}
      const check=(await client.query(`select currency_code,
        extract(day from $2::date)=1 and $3::date between $2::date and (clock_timestamp() at time zone 'Asia/Vientiane')::date
          and $3::date < ($2::date + interval '1 month')::date as valid_test,
        ($4::timestamptz at time zone 'Asia/Vientiane')::date=$2::date
          and ($5::timestamptz at time zone 'Asia/Vientiane')::date=$3::date as matching_cycle_dates
        from restaurants where id=$1`,[auth.restaurantId,month,end,cycleStartAt,cycleCutoffAt])).rows[0];
      if(check?.currency_code!=="LAK" || (test ? (!orderFeeTestMode || !check?.valid_test) : !check?.matching_cycle_dates)){await client.query("rollback");return reply.code(400).send({error:"CYCLE_NOT_READY"});}
      if(!test){
        const billing=await getOrderFeeBillingState(client,auth.restaurantId,false);
        const expectedCycle=billing.payableCycle;
        if(!expectedCycle || expectedCycle.startAt!==cycleStartAt || expectedCycle.cutoffAt!==cycleCutoffAt || Date.now()<Date.parse(expectedCycle.cutoffAt)) { await client.query("rollback"); return reply.code(409).send({error:"CYCLE_CHANGED"}); }
      }
      const snapshot=await orderFeeSnapshot(client,auth.restaurantId,cycleStartAt,cycleCutoffAt,test);
      if(Number(snapshot.fee_lak)!==Number(expectedFee) || rate!==Number(expectedRate)){await client.query("rollback");return reply.code(409).send({error:"SUMMARY_CHANGED"});}
      const usd=Math.round(Number(snapshot.fee_lak)/rate*100)/100;
      if(!snapshot.bill_count || usd<=0){await client.query("rollback");return reply.code(400).send({error:"NO_PAYABLE_AMOUNT"});}
      const prior=(await client.query("select id from order_fee_requests where restaurant_id=$1 and cycle_cutoff_at=$2 and status='pending' and is_test=$3",[auth.restaurantId,cycleCutoffAt,test])).rows[0];
      if(prior){await client.query("rollback");return reply.code(409).send({error:"CYCLE_ALREADY_SUBMITTED"});}
      const result=await client.query(`insert into order_fee_requests(request_key,restaurant_id,requested_by,month_start,period_end,cycle_start_at,cycle_cutoff_at,is_test,bill_count,fee_lak,rate_lak,amount_usd,bill_fingerprint,slip_type,slip_data) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id,status`,[key,auth.restaurantId,auth.user.id,month,end,cycleStartAt,cycleCutoffAt,test,snapshot.bill_count,snapshot.fee_lak,rate,usd,snapshot.fingerprint,image.type,image.data]);
      await client.query(`insert into order_fee_request_bills(request_id,bill_id) select $4,b.id from bill_payment_details b where b.restaurant_id=$1 and b.reopened_at is null and (case when $5 then b.paid_at >= $2::timestamptz else true end) and b.paid_at < $3::timestamptz and not exists (select 1 from order_fee_request_bills l join order_fee_requests r on r.id=l.request_id where l.bill_id=b.id and r.status in ('approved','pending') and r.is_test=$5)`,[auth.restaurantId,cycleStartAt,cycleCutoffAt,result.rows[0].id,test]);
      const linked=await orderFeeSnapshot(client,auth.restaurantId,cycleStartAt,cycleCutoffAt,test,result.rows[0].id);
      if(linked.fingerprint!==snapshot.fingerprint){await client.query("rollback");return reply.code(409).send({error:"SUMMARY_CHANGED"});}
      if(isAdmin) await client.query(`insert into platform_admin_audit_logs(admin_user_id,action,target_type,target_id,restaurant_id,details,ip_address) values($1,'order_fee.submitted_by_admin','order_fee_request',$2,$3,$4::jsonb,$5)`,[auth.user.id,result.rows[0].id,auth.restaurantId,JSON.stringify({month,periodEnd:end,cycleStartAt,cycleCutoffAt,isTest:test,feeLak:snapshot.fee_lak,rateLak:rate,amountUsd:usd}),request.ip]);
      await client.query("commit");return reply.code(201).send({request:result.rows[0]});
    } catch(error){await client.query("rollback");throw error;} finally{client.release();}
  }
  const post_order_fee_request = async (request,reply) => {
    const auth=await owner(request,reply);if(!auth)return;
    return submitOrderFeeRequest(request,reply,auth,false);
  };
  const post_admin_order_fee_request = async (request,reply) => {
    const admin=await requirePlatformAdmin(request,reply,env,["super_admin","support"]);if(!admin)return;
    if(!uuid(request.params.restaurantId))return reply.code(400).send({error:"INVALID_RESTAURANT"});
    return submitOrderFeeRequest(request,reply,{restaurantId:request.params.restaurantId,user:admin.user},true);
  };
  const get_admin_order_fee_requests = async (request,reply) => {
    if(!await requirePlatformAdmin(request,reply,env))return;
    const status=request.query.status || "pending"; if(!["pending","approved","rejected","reversed","all"].includes(status))return reply.code(400).send({error:"INVALID_STATUS"});
    if(request.query.restaurantId && !uuid(request.query.restaurantId)) return reply.code(400).send({error:"INVALID_RESTAURANT"});
    const rows=(await app.db.query(`select f.id,f.month_start::text,f.period_end::text,f.cycle_start_at,f.cycle_cutoff_at,f.is_test,f.bill_count,f.fee_lak,f.rate_lak,f.amount_usd,f.status,f.created_at,f.reviewed_at,f.review_note,r.name as restaurant_name,u.email as requester_email, exists(select 1 from platform_admin_audit_logs a where a.target_type='order_fee_request' and a.target_id=f.id and a.action='order_fee.submitted_by_admin') as submitted_by_admin from order_fee_requests f join restaurants r on r.id=f.restaurant_id join app_users u on u.id=f.requested_by where ($1='all' or f.status=$1) and ($2::uuid is null or f.restaurant_id=$2) order by f.created_at desc limit 100`,[status,request.query.restaurantId || null])).rows;
    const billing=request.query.restaurantId ? await getOrderFeeBillingState(app.db,request.query.restaurantId,orderFeeTestMode) : undefined;
    reply.header("Cache-Control","private, no-store");return {requests:rows,billing};
  };
  const get_admin_order_fee_slip = async (request,reply) => {
    if(!await requirePlatformAdmin(request,reply,env))return;
    if(!uuid(request.params.id))return reply.code(400).send({error:"INVALID_REQUEST"});
    const row=(await app.db.query("select slip_type,slip_data from order_fee_requests where id=$1",[request.params.id])).rows[0];
    if(!row)return reply.code(404).send({error:"NOT_FOUND"});
    reply.header("Cache-Control","private, no-store");return {contentType:row.slip_type,data:row.slip_data.toString("base64")};
  };
  const post_admin_order_fee_review = async (request,reply) => {
    const admin=await requirePlatformAdmin(request,reply,env,["super_admin","support"]);if(!admin)return;
    const body=request.body||{};if(!uuid(request.params.id)||!["approved","rejected"].includes(body.status)||typeof (body.note??"")!=="string"||(body.note||"").length>1000)return reply.code(400).send({error:"INVALID_REVIEW"});
    const client=await app.db.connect();try {
      await client.query("begin");const row=(await client.query("select *,month_start::text as month_text,period_end::text as end_text from order_fee_requests where id=$1 for update",[request.params.id])).rows[0];
      if(!row){await client.query("rollback");return reply.code(404).send({error:"NOT_FOUND"});}
      if(row.status!=="pending"){await client.query("rollback");return reply.code(409).send({error:"ALREADY_REVIEWED"});}
      if(body.status==="approved") {const current=await orderFeeSnapshot(client,row.restaurant_id,row.cycle_start_at,row.cycle_cutoff_at,row.is_test,row.id);if(current.fingerprint!==row.bill_fingerprint){await client.query("rollback");return reply.code(409).send({error:"BILLS_CHANGED"});}}
      await client.query("update order_fee_requests set status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4 where id=$1",[row.id,body.status,admin.user.id,(body.note||"").trim()]);
      await client.query(`insert into platform_admin_audit_logs(admin_user_id,action,target_type,target_id,restaurant_id,details,ip_address) values($1,$2,'order_fee_request',$3,$4,$5::jsonb,$6)`,[admin.user.id,`order_fee.${body.status}`,row.id,row.restaurant_id,JSON.stringify({month:row.month_text,periodEnd:row.end_text,isTest:row.is_test,amountUsd:row.amount_usd,feeLak:row.fee_lak}),request.ip]);
      await client.query("commit");return {ok:true};
    }catch(error){await client.query("rollback");throw error;}finally{client.release();}
  };
  const post_admin_order_fee_reverse = async (request,reply) => {
    const admin=await requirePlatformAdmin(request,reply,env,["super_admin","support"]);if(!admin)return;
    const reason=typeof request.body?.reason === "string" ? request.body.reason.trim() : "";
    if(!uuid(request.params.id) || !reason || reason.length>1000)return reply.code(400).send({error:"INVALID_REASON"});
    const client=await app.db.connect();try {
      await client.query("begin");
      const row=(await client.query("select *,month_start::text as month_text,period_end::text as end_text from order_fee_requests where id=$1 for update",[request.params.id])).rows[0];
      if(!row){await client.query("rollback");return reply.code(404).send({error:"NOT_FOUND"});}
      if(row.status!=="approved"){await client.query("rollback");return reply.code(409).send({error:"NOT_APPROVED"});}
      await client.query("update order_fee_requests set status='reversed' where id=$1",[row.id]);
      await client.query(`insert into platform_admin_audit_logs(admin_user_id,action,target_type,target_id,restaurant_id,reason,details,ip_address) values($1,'order_fee.reversed','order_fee_request',$2,$3,$4,$5::jsonb,$6)`,[admin.user.id,row.id,row.restaurant_id,reason,JSON.stringify({month:row.month_text,periodEnd:row.end_text,isTest:row.is_test,amountUsd:row.amount_usd,feeLak:row.fee_lak,previousReviewer:row.reviewed_by,previousReviewedAt:row.reviewed_at}),request.ip]);
      await client.query("commit");return {ok:true};
    }catch(error){await client.query("rollback");throw error;}finally{client.release();}
  };
  const get_api_restaurants_restaurantId_pro_requests = async (request, reply) => {
    if (!await owner(request, reply)) return;
    const offset = Math.max(0, Math.min(100000, Number(request.query.offset) || 0)) | 0;
    const result = await app.db.query(`select ${columns} ${joins} where p.restaurant_id=$1 order by p.created_at desc, p.id desc limit 50 offset $2`, [request.params.restaurantId, offset]);
    return { requests: result.rows };
  };
  const post_api_restaurants_restaurantId_pro_requests = async (request, reply) => {
    const auth = await owner(request, reply); if (!auth) return;
    const image = await readImage(request, reply); if (!image) return;
    const field = (name) => image.fields[name]?.value;
    const body = {requestKey:field("requestKey"), paidMonths:Number(field("paidMonths")), monthlyUsd:field("monthlyUsd")};
    if (!uuid(body.requestKey) || ![1,3,6,9,12].includes(body.paidMonths) ||
        typeof body.monthlyUsd !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(body.monthlyUsd) ||
        Number(body.monthlyUsd) <= 0 || Number(body.monthlyUsd) > 1000000) {
      return reply.code(400).send({error:"INVALID_REQUEST"});
    }
    const client = await app.db.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`pro:${auth.restaurantId}`]);
      await client.query("select id from restaurants where id=$1 for update", [auth.restaurantId]);
      const existing = (await client.query("select * from pro_requests where request_key=$1", [body.requestKey])).rows[0];
      if (existing) {
        await client.query("rollback");
        if (existing.restaurant_id !== auth.restaurantId || existing.requested_by !== auth.user.id || existing.paid_months !== body.paidMonths || Number(existing.monthly_usd) !== Number(body.monthlyUsd)) return reply.code(409).send({error:"REQUEST_CONFLICT"});
        return {request:existing};
      }
      const active = (await client.query(`select max(reviewed_at + (paid_months + free_months) * interval '30 days') as expires_at
        from pro_requests where restaurant_id=$1 and status='approved' and cancelled_at is null
        having max(reviewed_at + (paid_months + free_months) * interval '30 days') > clock_timestamp()`, [auth.restaurantId])).rows[0];
      if (active) { await client.query("rollback"); return reply.code(409).send({error:"PRO_ACTIVE",expiresAt:active.expires_at}); }
      const trial = (await client.query("select expires_at from restaurant_pro_trials where restaurant_id=$1 and expires_at>clock_timestamp() for update", [auth.restaurantId])).rows[0];
      if (trial) { await client.query("rollback"); return reply.code(409).send({error:"PRO_ACTIVE",expiresAt:trial.expires_at,trial:true}); }
      const orderFeeBalance=(await client.query(`select coalesce(sum(case when b.bill_total < 50000 then 0 when b.bill_total < 100000 then 200
        when b.bill_total < 250000 then 300 when b.bill_total < 400000 then 400 when b.bill_total < 1000000 then 500
        when b.bill_total < 1500000 then 1000 when b.bill_total < 2500000 then 1250 else 1450 end),0)::text as fee_lak
        from bill_payment_details b where b.restaurant_id=$1 and b.reopened_at is null
          and not exists(select 1 from order_fee_request_bills l join order_fee_requests f on f.id=l.request_id
            where l.bill_id=b.id and f.status='approved' and f.is_test=$2)`,[auth.restaurantId,orderFeeTestMode])).rows[0];
      if(Number(orderFeeBalance?.fee_lak||0)>0){await client.query("rollback");return reply.code(409).send({error:"ORDER_FEES_OUTSTANDING",feeLak:orderFeeBalance.fee_lak});}
      const pending = (await client.query("select id from pro_requests where restaurant_id=$1 and status='pending'", [auth.restaurantId])).rows[0];
      if (pending) { await client.query("rollback"); return reply.code(409).send({error:"REQUEST_PENDING"}); }
      const free = body.paidMonths === 12 ? 2 : [6,9].includes(body.paidMonths) ? 1 : 0;
      const pricing=(await client.query("select monthly_usd from pro_pricing where id=true for share")).rows[0];
      if(!pricing?.monthly_usd || Number(pricing.monthly_usd)!==Number(body.monthlyUsd)) {
        await client.query("rollback");return reply.code(409).send({error:"PRICE_CHANGED"});
      }
      const result = await client.query(`insert into pro_requests (request_key,restaurant_id,requested_by,paid_months,free_months,monthly_usd,total_usd)
        values ($1,$2,$3,$4::integer,$5,$6::numeric,$6::numeric*$4::integer) returning *`, [body.requestKey,auth.restaurantId,auth.user.id,body.paidMonths,free,pricing.monthly_usd]);
      await client.query("insert into pro_payment_slips(pro_request_id,content_type,image_data) values($1,$2,$3)",[result.rows[0].id,image.type,image.data]);
      await client.query("commit");
      return reply.code(201).send({request:result.rows[0]});
    } catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  };
  const get_api_admin_pro_requests = async (request, reply) => {
    if (!await requirePlatformAdmin(request, reply, env)) return;
    const status = request.query.status || "all";
    if (!["all","pending","approved","rejected"].includes(status)) return reply.code(400).send({error:"INVALID_STATUS"});
    const restaurantId = request.query.restaurantId || null;
    if (restaurantId && !uuid(restaurantId)) return reply.code(400).send({error:"INVALID_RESTAURANT"});
    const offset = Math.max(0, Math.min(100000, Number(request.query.offset) || 0)) | 0;
    const result = await app.db.query(`select ${columns}, exists(select 1 from pro_payment_slips s where s.pro_request_id=p.id) as has_slip,
      exists(select 1 from platform_admin_audit_logs l
        where l.target_type='pro_request' and l.target_id=p.id and l.action='pro_purchase.activated') as admin_purchase
      ${joins} where ($1='all' or p.status=$1) and ($3::uuid is null or p.restaurant_id=$3) order by p.created_at desc,p.id desc limit 50 offset $2`, [status,offset,restaurantId]);
    return { requests:result.rows };
  };
  const post_api_admin_restaurants_restaurantId_pro_purchases = async (request, reply) => {
    const admin = await requirePlatformAdmin(request, reply, env, ["super_admin", "support"]);
    if (!admin) return;
    const restaurantId = request.params.restaurantId;
    const body = request.body || {};
    const paymentReference = typeof body.paymentReference === "string" ? body.paymentReference.trim() : "";
    if (!uuid(restaurantId) || !uuid(body.requestKey) || ![1, 3, 6, 9, 12].includes(body.paidMonths) ||
        !Number.isSafeInteger(body.pricingVersion) || body.paymentReceived !== true ||
        !["cash", "transfer", "qr", "card", "other"].includes(body.paymentMethod) || paymentReference.length > 200) {
      return reply.code(400).send({ error: "INVALID_PURCHASE" });
    }

    const client = await app.db.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`pro:${restaurantId}`]);
      const restaurant = (await client.query("select id, name from restaurants where id=$1 for update", [restaurantId])).rows[0];
      if (!restaurant) {
        await client.query("rollback");
        return reply.code(404).send({ error: "RESTAURANT_NOT_FOUND" });
      }

      const existing = (await client.query("select * from pro_requests where request_key=$1", [body.requestKey])).rows[0];
      if (existing) {
        await client.query("rollback");
        if (existing.restaurant_id !== restaurantId || existing.requested_by !== admin.user.id ||
            existing.paid_months !== body.paidMonths || existing.status !== "approved") {
          return reply.code(409).send({ error: "REQUEST_CONFLICT" });
        }
        return reply.send({ request: existing });
      }

      const activePaid = (await client.query(`select max(reviewed_at + (paid_months + free_months) * interval '30 days') as expires_at
        from pro_requests where restaurant_id=$1 and status='approved' and cancelled_at is null
        having max(reviewed_at + (paid_months + free_months) * interval '30 days') > clock_timestamp()`, [restaurantId])).rows[0];
      const trialTable = (await client.query("select to_regclass('restaurant_pro_trials') is not null as present")).rows[0]?.present;
      const activeTrial = trialTable
        ? (await client.query("select expires_at from restaurant_pro_trials where restaurant_id=$1 and expires_at>clock_timestamp() for update", [restaurantId])).rows[0]
        : null;
      if (activePaid || activeTrial) {
        await client.query("rollback");
        return reply.code(409).send({ error: "PRO_ACTIVE", expiresAt: activeTrial?.expires_at ?? activePaid?.expires_at });
      }

      const orderFeeBalance = (await client.query(`select coalesce(sum(case when b.bill_total < 50000 then 0 when b.bill_total < 100000 then 200
        when b.bill_total < 250000 then 300 when b.bill_total < 400000 then 400 when b.bill_total < 1000000 then 500
        when b.bill_total < 1500000 then 1000 when b.bill_total < 2500000 then 1250 else 1450 end),0)::text as fee_lak
        from bill_payment_details b where b.restaurant_id=$1 and b.reopened_at is null
          and not exists(select 1 from order_fee_request_bills l join order_fee_requests f on f.id=l.request_id
            where l.bill_id=b.id and f.status='approved' and f.is_test=$2)`, [restaurantId, orderFeeTestMode])).rows[0];
      if (Number(orderFeeBalance?.fee_lak || 0) > 0) {
        await client.query("rollback");
        return reply.code(409).send({ error: "ORDER_FEES_OUTSTANDING", feeLak: orderFeeBalance.fee_lak });
      }

      const pending = (await client.query("select id from pro_requests where restaurant_id=$1 and status='pending'", [restaurantId])).rows[0];
      if (pending) {
        await client.query("rollback");
        return reply.code(409).send({ error: "REQUEST_PENDING" });
      }
      const pricing = (await client.query("select monthly_usd, version from pro_pricing where id=true for share")).rows[0];
      if (!pricing?.monthly_usd || Number(pricing.version) !== body.pricingVersion) {
        await client.query("rollback");
        return reply.code(409).send({ error: pricing?.monthly_usd ? "PRICE_CHANGED" : "PRICE_NOT_CONFIGURED" });
      }

      const freeMonths = body.paidMonths === 12 ? 2 : [6, 9].includes(body.paidMonths) ? 1 : 0;
      const purchase = (await client.query(`insert into pro_requests
          (request_key, restaurant_id, requested_by, paid_months, free_months, monthly_usd, total_usd,
           status, reviewed_by, reviewed_at, review_note)
        values ($1, $2, $3, $4, $5, $6::numeric, $6::numeric * $4::integer, 'approved', $3, clock_timestamp(), $7)
        returning *`, [body.requestKey, restaurantId, admin.user.id, body.paidMonths, freeMonths,
          pricing.monthly_usd, "ซื้อโดยแอดมินหลังยืนยันว่าได้รับเงินแล้ว"])).rows[0];
      await client.query(`insert into platform_admin_audit_logs
          (admin_user_id, action, target_type, target_id, restaurant_id, reason, details, ip_address)
        values ($1, 'pro_purchase.activated', 'pro_request', $2, $3,
          'payment_received', $4::jsonb, $5)`, [admin.user.id, purchase.id, restaurantId,
        JSON.stringify({ paidMonths: body.paidMonths, freeMonths, monthlyUsd: pricing.monthly_usd,
          totalUsd: purchase.total_usd, currency: "USD", paymentReceived: true,
          paymentMethod: body.paymentMethod, paymentReference }), request.ip]);
      await client.query(`insert into platform_finance_entries
          (request_key, kind, entry_date, category, description, amount, currency_code, payment_method,
           reference, source, restaurant_id, pro_request_id, created_by, created_at)
        values ($1, 'income', (clock_timestamp() at time zone 'Asia/Bangkok')::date,
          'แพ็กเกจ Pro', $2, $3::numeric, 'USD', $4, $5, 'pro_package', $6, $7, $8, clock_timestamp())`,
        [body.requestKey, `แพ็กเกจ Pro · ${restaurant.name} · ${body.paidMonths} เดือน${freeMonths ? ` แถม ${freeMonths} เดือน` : ""}`,
          purchase.total_usd, body.paymentMethod, paymentReference, restaurantId, purchase.id, admin.user.id]);
      await client.query("commit");
      return reply.code(201).send({ request: purchase });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };
  const post_api_admin_pro_requests_id_review = async (request, reply) => {
    const admin = await requirePlatformAdmin(request, reply, env, ["super_admin","support"]); if (!admin) return;
    const body = request.body || {};
    if (!uuid(request.params.id) || !["approved","rejected"].includes(body.status) || (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 1000))) return reply.code(400).send({error:"INVALID_REVIEW"});
    const client = await app.db.connect();
    try {
      await client.query("begin");
      const row = (await client.query("select * from pro_requests where id=$1 for update", [request.params.id])).rows[0];
      if (!row) { await client.query("rollback"); return reply.code(404).send({error:"NOT_FOUND"}); }
      if (row.status !== "pending") {
        await client.query("rollback");
        if (row.status === body.status) return {request:row};
        return reply.code(409).send({error:"ALREADY_REVIEWED"});
      }
      await client.query("select id from restaurants where id=$1 for update", [row.restaurant_id]);
      const result = await client.query(`update pro_requests set status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4 where id=$1 returning *`, [row.id,body.status,admin.user.id,body.note?.trim() || ""]);
      if (body.status === "approved") {
        const restaurant = (await client.query("select name from restaurants where id=$1",[row.restaurant_id])).rows[0];
        await client.query(`insert into platform_finance_entries (request_key,kind,entry_date,category,description,amount,currency_code,payment_method,reference,source,restaurant_id,pro_request_id,created_by,created_at)
          values ($1,'income',(clock_timestamp() at time zone 'Asia/Bangkok')::date,'แพ็กเกจ Pro',$2,$3::numeric,'USD','transfer','','pro_package',$4,$5,$6,clock_timestamp())`,[row.request_key,`แพ็กเกจ Pro · ${restaurant.name} · ${row.paid_months} เดือน`,row.total_usd,row.restaurant_id,row.id,admin.user.id]);
      }
      await client.query(`insert into platform_admin_audit_logs (admin_user_id,action,target_type,target_id,restaurant_id,reason,details,ip_address)
        values ($1,$2,'pro_request',$3,$4,$5,$6::jsonb,$7)`, [admin.user.id,`pro_request.${body.status}`,row.id,row.restaurant_id,body.note?.trim() || "",JSON.stringify({paidMonths:row.paid_months,totalUsd:row.total_usd,currency:"USD",mode:body.status === "approved" ? "payment_review" : "rejected"}),request.ip]);
      await client.query("commit");
      return {request:result.rows[0]};
    } catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  };
  const post_admin_pro_cancel = async (request,reply) => {
    const admin=await requirePlatformAdmin(request,reply,env,["super_admin","support"]);if(!admin)return;
    const reason=typeof request.body?.reason === "string" ? request.body.reason.trim() : "";
    if(!uuid(request.params.id) || !reason || reason.length>1000)return reply.code(400).send({error:"INVALID_REASON"});
    const client=await app.db.connect();try {
      await client.query("begin");
      const initial=(await client.query("select restaurant_id from pro_requests where id=$1",[request.params.id])).rows[0];
      if(!initial){await client.query("rollback");return reply.code(404).send({error:"NOT_FOUND"});}
      await client.query("select pg_advisory_xact_lock(hashtext($1))",[`pro:${initial.restaurant_id}`]);
      const row=(await client.query(`select *, reviewed_at+(paid_months+free_months)*interval '30 days' as expires_at,
        reviewed_at+(paid_months+free_months)*interval '30 days'>clock_timestamp() as active
        from pro_requests where id=$1 for update`,[request.params.id])).rows[0];
      if(row.status!=="approved" || row.cancelled_at || !row.active){await client.query("rollback");return reply.code(409).send({error:"PACKAGE_NOT_ACTIVE"});}
      await client.query("update pro_requests set cancelled_at=clock_timestamp(),cancelled_by=$2,cancellation_reason=$3 where id=$1",[row.id,admin.user.id,reason]);
      await client.query(`insert into platform_admin_audit_logs(admin_user_id,action,target_type,target_id,restaurant_id,reason,details,ip_address) values($1,'pro_package.cancelled','pro_request',$2,$3,$4,$5::jsonb,$6)`,[admin.user.id,row.id,row.restaurant_id,reason,JSON.stringify({paidMonths:row.paid_months,freeMonths:row.free_months,totalUsd:row.total_usd,previousExpiresAt:row.expires_at}),request.ip]);
      await client.query("commit");return {ok:true};
    }catch(error){await client.query("rollback");throw error;}finally{client.release();}
  };
  const get_admin_active_pro_packages = async (request,reply) => {
    if(!await requirePlatformAdmin(request,reply,env))return;
    if(!uuid(request.params.restaurantId))return reply.code(400).send({error:"INVALID_RESTAURANT"});
    const result=await app.db.query(`select id,paid_months,free_months,total_usd,reviewed_at,reviewed_at+(paid_months+free_months)*interval '30 days' as expires_at from pro_requests where restaurant_id=$1 and status='approved' and cancelled_at is null and reviewed_at+(paid_months+free_months)*interval '30 days'>clock_timestamp() order by reviewed_at desc`,[request.params.restaurantId]);
    reply.header("Cache-Control","private, no-store");return {packages:result.rows};
  };
  return { get_api_pro_payment_qr, put_api_admin_pro_payment_qr, get_api_admin_pro_request_slip, get_api_admin_pro_request_count, get_api_pro_pricing, get_api_admin_pro_pricing, put_api_admin_pro_pricing, get_api_restaurants_restaurantId_pro_countdown, get_api_restaurants_restaurantId_pro_exchange_rate, get_admin_pro_exchange_rate, get_api_restaurants_restaurantId_pro_order_bills, get_admin_order_bills_summary, get_order_fee_requests, get_order_fee_billing_status, post_order_fee_request, post_admin_order_fee_request, get_admin_order_fee_requests, get_admin_order_fee_slip, post_admin_order_fee_review, post_admin_order_fee_reverse, get_api_restaurants_restaurantId_pro_requests, post_api_restaurants_restaurantId_pro_requests, get_api_admin_pro_requests, post_api_admin_restaurants_restaurantId_pro_purchases, post_api_admin_pro_requests_id_review, post_admin_pro_cancel, get_admin_active_pro_packages };
}


