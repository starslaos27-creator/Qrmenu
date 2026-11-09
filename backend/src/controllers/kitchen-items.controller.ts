import { requireRestaurantAccess } from '../security/authorization.js';

export function createKitchenItemController(app, env, { applyOrderStock, insertAudit }) {
  const patch_api_restaurants_restaurantId_orders_orderId_items_itemIndex_resolve = async (request, reply) => {
        const {restaurantId,orderId,itemIndex}=request.params;
        const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if(!uuid.test(restaurantId)||!uuid.test(orderId)||!/^(0|[1-9]\d*)$/.test(itemIndex))return reply.code(400).send({error:'INVALID_ID'});
        const access=await requireRestaurantAccess(request,reply,env,restaurantId,['owner','cook']);if(!access)return;
        const {action,qty,note,expected_items}=request.body||{};
        if(!['edit','remove','cancel'].includes(action)||!Array.isArray(expected_items)||(action==='edit'&&(!Number.isSafeInteger(qty)||qty<1||qty>999||typeof note!=='string'||note.length>500)))return reply.code(400).send({error:'INVALID_BODY'});
        const client=await app.db.connect();
        try{
            await client.query('begin');
            const {rows}=await client.query('select *, items=$3::jsonb as matches from orders where id=$1 and restaurant_id=$2 for update',[orderId,restaurantId,JSON.stringify(expected_items)]);const order=rows[0];
            const fail=async(code,error)=>{await client.query('rollback');return reply.code(code).send({ok:false,error})};
            if(!order)return await fail(404,'NOT_FOUND');
            if(!order.matches)return await fail(409,'ORDER_ITEMS_CHANGED');
            if(order.paid||order.stock_applied_at||!['pending','ready'].includes(order.status))return await fail(409,'INVALID_ORDER_STATE');
            const index=Number(itemIndex);if(!Number.isSafeInteger(index)||index>=order.items.length)return await fail(400,'INVALID_ITEM_INDEX');
            if(action!=='cancel'&&order.item_confirmations?.[itemIndex])return await fail(409,'ORDER_ITEMS_CONFIRMED');
            const cancel=action==='cancel'||(action==='remove'&&order.items.length===1);
            let items=order.items,confirmations={...order.item_confirmations};
            if(!cancel){
                if(action==='edit')items=items.map((item,i)=>i===index?{...item,qty,note:note.trim()}:item);
                else {items=items.filter((_,i)=>i!==index);confirmations={};for(const [key,value] of Object.entries(order.item_confirmations||{})){const i=Number(key);if(i!==index)confirmations[String(i>index?i-1:i)]=value}}
            }
            const total=items.reduce((sum,item)=>sum+Number(item.unit_price)*item.qty,0);
            const updated=await client.query("update orders set items=$3::jsonb,total=$4,item_confirmations=$5::jsonb,status=case when $6 then 'cancelled'::order_status else status end,cancel_reason=case when $6 then 'Cancelled from kitchen: stock unavailable' else cancel_reason end,completed_at=case when $6 then now() else completed_at end,completed_by=case when $6 then $7::uuid else completed_by end where id=$1 and restaurant_id=$2 returning *",[orderId,restaurantId,JSON.stringify(items),total,JSON.stringify(confirmations),cancel,access.user.id]);
            await insertAudit(client,restaurantId,access.user.id,{action:cancel?'order.cancel':'order.edit',targetId:orderId,details:{action,item_index:index,before:order.items,after:items}});
            await client.query('commit');return reply.send({ok:true,order:updated.rows[0]});
        }catch(error){await client.query('rollback');throw error}finally{client.release()}
    };
  const post_api_restaurants_restaurantId_orders_orderId_items_itemIndex_confirm = async (request, reply) => {
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const {restaurantId, orderId, itemIndex} = request.params;
        if (!uuid.test(restaurantId) || !uuid.test(orderId) || !/^(0|[1-9]\d*)$/.test(itemIndex))
            return reply.code(400).send({ok:false,error:'INVALID_ID'});
        const access = await requireRestaurantAccess(request, reply, env, restaurantId, ['owner','cook','waiter','staff']);
        if (!access) return;
        if (!Array.isArray(request.body?.expected_items))
            return reply.code(400).send({ok:false,error:'INVALID_BODY'});
        const client = await app.db.connect();
        try {
            await client.query('begin');
            const result = await client.query(`select *, items = $3::jsonb as items_match from orders
                where id=$1 and restaurant_id=$2 for update`, [orderId,restaurantId,JSON.stringify(request.body.expected_items)]);
            const order = result.rows[0];
            if (!order) {await client.query('rollback');return reply.code(404).send({ok:false,error:'NOT_FOUND'});}
            if (!order.items_match) {await client.query('rollback');return reply.code(409).send({ok:false,error:'ORDER_ITEMS_CHANGED'});}
            delete order.items_match;
            const index = Number(itemIndex);
            if (!Number.isSafeInteger(index) || index >= order.items.length) {
                await client.query('rollback');return reply.code(400).send({ok:false,error:'INVALID_ITEM_INDEX'});
            }
            if (order.status === 'cancelled') {
                await client.query('rollback');return reply.code(409).send({ok:false,error:'INVALID_ORDER_STATE'});
            }
            if (order.status === 'served' || order.item_confirmations[itemIndex]) {
                await client.query('commit');return reply.send({ok:true,order});
            }
            const user = (await client.query('select display_name,email from app_users where id=$1',[access.user.id])).rows[0];
            const confirmations = {...order.item_confirmations,[itemIndex]:{
                user_id:access.user.id,user_name:user?.display_name?.trim() || user?.email || access.user.id,
                confirmed_at:new Date().toISOString()
            }};
            const complete = order.items.every((_, i) => confirmations[String(i)]);
            // Stock remains atomic for the order and is consumed once on completion.
            if (complete && !order.stock_applied_at)
                await applyOrderStock(client,orderId,restaurantId,access.user.id);
            const updated = await client.query(`update orders set item_confirmations=$3::jsonb,
                status=case when $4 then 'served'::order_status else status end,
                completed_at=case when $4 then now() else completed_at end,
                completed_by=case when $4 then $5::uuid else completed_by end
                where id=$1 and restaurant_id=$2 returning *`,[orderId,restaurantId,JSON.stringify(confirmations),complete,access.user.id]);
            await insertAudit(client,restaurantId,access.user.id,{action:'order.item.confirm',targetId:orderId,
                details:{item_index:index,menu_id:order.items[index].menu_id,qty:order.items[index].qty}});
            if (complete) await insertAudit(client,restaurantId,access.user.id,{action:'order.served',targetId:orderId,
                details:{from:order.status,to:'served',via:'item_confirmations'}});
            await client.query('commit');
            return reply.send({ok:true,order:updated.rows[0]});
        } catch(error) {
            await client.query('rollback');
            if (error.message?.includes('INSUFFICIENT_STOCK')) return reply.code(409).send({ok:false,error:'INSUFFICIENT_STOCK'});
            if (error.code === 'DEFAULT_STOCK_LOCATION_MISSING') return reply.code(409).send({ok:false,error:error.code});
            throw error;
        } finally {client.release();}
    };
  return { patch_api_restaurants_restaurantId_orders_orderId_items_itemIndex_resolve, post_api_restaurants_restaurantId_orders_orderId_items_itemIndex_confirm };
}


