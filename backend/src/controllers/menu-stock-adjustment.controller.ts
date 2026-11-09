import {randomUUID} from 'node:crypto';
import {receiptSnapshot} from './menu-stock-history.controller.js';

export function createMenuStockAdjustmentController(app, env, { accessOwner, isUuid, invalidId, invalidBody }) {
  const post_api_restaurants_restaurantId_menus_resourceId_receive = (request, reply) => {
        request.body = {...request.body, movement_type:'purchase', request_id:request.body?.request_id ?? randomUUID()};
        return adjust(request, reply);
    };
  app.post('/api/restaurants/:restaurantId/menus/:resourceId/stock-adjustments', adjust);
  async function adjust(request, reply) {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId)) return access ? invalidId(reply) : undefined;
        const body = request.body ?? {}, type = body.movement_type, quantity = body.quantity;
        const types = ['purchase', 'issue', 'waste', 'adjustment', 'return_in', 'return_out'];
        const validAmount = value => Number.isFinite(value) && value >= 0 && value <= 1000000000 && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.00001;
        if (!types.includes(type) || !validAmount(quantity) || (type !== 'adjustment' && quantity === 0) ||
            !isUuid(body.request_id) || (body.note != null && (typeof body.note !== 'string' || body.note.length > 500)) ||
            (type === 'adjustment' && !validAmount(body.expected_quantity))) return invalidBody(reply);
        const note = body.note?.trim() || null;
        const client = await app.db.connect();
        try {
            await client.query('begin');
            const params = [request.params.resourceId, access.restaurantId];
            const selected = await client.query('select * from menus where id = $1 and restaurant_id = $2 for update', params);
            const menu = selected.rows[0];
            if (!menu) { await client.query('rollback'); return reply.status(404).send({ok:false,error:'NOT_FOUND'}); }
            const previous = await client.query(`select details from audit_logs where restaurant_id = $1 and target_id = $2
                and action = 'menu.stock_adjustment' and details->>'request_id' = $3`, [access.restaurantId, menu.id, body.request_id]);
            if (previous.rows[0]) {
                const details = previous.rows[0].details;
                await client.query('rollback');
                if (details.movement_type !== type || details.quantity !== quantity || details.note !== note)
                    return reply.status(409).send({ok:false,error:'REQUEST_CONFLICT'});
                return reply.send({ok:true,menu});
            }
            const before = Number(menu.stock_quantity) || 0;
            if (type === 'adjustment' && Math.round(before * 1000) !== Math.round(body.expected_quantity * 1000)) {
                await client.query('rollback');
                return reply.status(409).send({ok:false,error:'STOCK_CHANGED'});
            }
            const after = Math.round((type === 'adjustment' ? quantity : before + (['issue','waste','return_out'].includes(type) ? -quantity : quantity)) * 1000) / 1000;
            if (after < 0 || after > 1000000000) {
                await client.query('rollback');
                return reply.status(409).send({ok:false,error:after < 0 ? 'INSUFFICIENT_STOCK' : 'STOCK_LIMIT'});
            }
            const updated = await client.query('update menus set stock_quantity = $3, track_stock = true where id = $1 and restaurant_id = $2 returning *', [...params, after]);
            const snapshot = await receiptSnapshot(client, menu, access.user.id);
            await client.query(`insert into audit_logs (restaurant_id, actor_user_id, action, target_id, details)
                values ($1,$2,'menu.stock_adjustment',$3,$4::jsonb)`, [access.restaurantId, access.user.id, menu.id, JSON.stringify({request_id:body.request_id,movement_type:type,quantity,note,before,after,...snapshot})]);
            await client.query('commit');
            return reply.send({ok:true,menu:updated.rows[0]});
        } catch (error) { await client.query('rollback'); throw error; }
        finally { client.release(); }
    }
  return { post_api_restaurants_restaurantId_menus_resourceId_receive };
}


