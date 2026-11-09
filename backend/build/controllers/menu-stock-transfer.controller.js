import { requireRestaurantAccess } from '../security/authorization.js';
import { receiptSnapshot } from './menu-stock-history.controller.js';
export function createMenuStockTransferController(app, env, { accessOwner, isUuid, invalidId, invalidBody }) {
    const get_api_restaurants_restaurantId_menu_transfer_destinations = async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select r.id, r.name from restaurants r
            join restaurant_members m on m.restaurant_id = r.id
            where m.user_id = $1 and m.role = 'owner' and r.id <> $2 and r.suspended_at is null
            order by r.name, r.id`, [access.user.id, access.restaurantId]);
        return reply.send({ ok: true, restaurants: result.rows });
    };
    const post_api_restaurants_restaurantId_menus_resourceId_stock_transfers = async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId))
            return access ? invalidId(reply) : undefined;
        const body = request.body ?? {}, quantity = body.quantity;
        if (!isUuid(body.destination_restaurant_id) || !isUuid(body.destination_menu_id) || !isUuid(body.request_id) ||
            body.destination_restaurant_id === access.restaurantId ||
            !Number.isFinite(quantity) || quantity < 0.001 || quantity > 1000000000 ||
            Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.00001 ||
            (body.note != null && (typeof body.note !== 'string' || body.note.length > 500)))
            return invalidBody(reply);
        const destinationAccess = await requireRestaurantAccess(request, reply, env, body.destination_restaurant_id, ['owner']);
        if (!destinationAccess)
            return;
        const note = body.note?.trim() || null;
        const client = await app.db.connect();
        try {
            await client.query('begin');
            // Both directions acquire rows in the same order to avoid transfer deadlocks.
            const rows = (await client.query(`select * from menus
                where (id = $1 and restaurant_id = $2) or (id = $3 and restaurant_id = $4)
                order by id for update`, [request.params.resourceId, access.restaurantId, body.destination_menu_id, body.destination_restaurant_id])).rows;
            const source = rows.find(row => row.id === request.params.resourceId && row.restaurant_id === access.restaurantId);
            const destination = rows.find(row => row.id === body.destination_menu_id && row.restaurant_id === body.destination_restaurant_id);
            if (!source || !destination) {
                await client.query('rollback');
                return reply.status(404).send({ ok: false, error: 'NOT_FOUND' });
            }
            const previous = (await client.query(`select details from audit_logs
                where restaurant_id = $1 and target_id = $2 and action = 'menu.stock_transfer_out' and details->>'request_id' = $3`, [access.restaurantId, source.id, body.request_id])).rows[0];
            if (previous) {
                await client.query('rollback');
                const details = previous.details;
                if (details.quantity !== quantity || details.note !== note || details.destination_restaurant_id !== body.destination_restaurant_id || details.destination_menu_id !== body.destination_menu_id)
                    return reply.status(409).send({ ok: false, error: 'REQUEST_CONFLICT' });
                return reply.send({ ok: true, menu: source, destination_menu: destination });
            }
            const unit = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
            if (!unit(source.unit) || unit(source.unit) !== unit(destination.unit)) {
                await client.query('rollback');
                return reply.status(400).send({ ok: false, error: 'UNIT_MISMATCH' });
            }
            const sourceBefore = Number(source.stock_quantity), destinationBefore = Number(destination.stock_quantity);
            const sourceAfter = Math.round((sourceBefore - quantity) * 1000) / 1000;
            const destinationAfter = Math.round((destinationBefore + quantity) * 1000) / 1000;
            if (sourceAfter < 0 || destinationAfter > 1000000000) {
                await client.query('rollback');
                return reply.status(409).send({ ok: false, error: sourceAfter < 0 ? 'INSUFFICIENT_STOCK' : 'STOCK_LIMIT' });
            }
            const updatedSource = (await client.query('update menus set stock_quantity=$3, track_stock=true where id=$1 and restaurant_id=$2 returning *', [source.id, access.restaurantId, sourceAfter])).rows[0];
            const updatedDestination = (await client.query('update menus set stock_quantity=$3, track_stock=true where id=$1 and restaurant_id=$2 returning *', [destination.id, body.destination_restaurant_id, destinationAfter])).rows[0];
            const details = { request_id: body.request_id, quantity, note, unit: source.unit, source_restaurant_id: access.restaurantId, source_menu_id: source.id, destination_restaurant_id: body.destination_restaurant_id, destination_menu_id: destination.id };
            for (const [restaurantId, menuId, action, before, after] of [
                [access.restaurantId, source.id, 'menu.stock_transfer_out', sourceBefore, sourceAfter],
                [body.destination_restaurant_id, destination.id, 'menu.stock_transfer_in', destinationBefore, destinationAfter]
            ])
                await client.query(`insert into audit_logs (restaurant_id,actor_user_id,action,target_id,details)
                values ($1,$2,$3,$4,$5::jsonb)`, [restaurantId, access.user.id, action, menuId, JSON.stringify({ ...details, before, after, ...await receiptSnapshot(client, menuId === source.id ? source : destination, access.user.id) })]);
            await client.query('commit');
            return reply.send({ ok: true, menu: updatedSource, destination_menu: updatedDestination });
        }
        catch (error) {
            await client.query('rollback');
            throw error;
        }
        finally {
            client.release();
        }
    };
    return { get_api_restaurants_restaurantId_menu_transfer_destinations, post_api_restaurants_restaurantId_menus_resourceId_stock_transfers };
}
