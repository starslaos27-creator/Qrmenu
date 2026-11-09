import { requireRestaurantAccess } from "../security/authorization.js";
import { registerKitchenItemRoutes } from "../routes/kitchen-items.js";
import { recordOrderMenuMovement } from "./menu-stock-outgoing.controller.js";

interface MenuPriceRow {
    id: string;
    name: string;
    name_lo: string | null;
    name_en: string | null;
    price: number | string;
    available: boolean;
}

export function createOrderController(app, env) {
  registerKitchenItemRoutes(app, env, {applyOrderStock, insertAudit});
  const get_api_restaurants_restaurantId_orders = async (request, reply) => {
        const access = await requireValidAccess(app, request, reply, env);
        if (!access)
            return;
        const paid = request.query.paid === "true"
            ? true
            : request.query.paid === "false"
                ? false
                : null;
        const statuses = request.query.status
            ?.split(",")
            .map((value) => value.trim())
            .filter(isOrderStatus);
        if (request.query.status && !statuses?.length) {
            return invalidBody(reply);
        }
        const since = request.query.since ? new Date(request.query.since) : null;
        if (since && Number.isNaN(since.getTime()))
            return invalidBody(reply);
        const until = request.query.until ? new Date(request.query.until) : null;
        const before = request.query.before ? new Date(request.query.before) : null;
        const beforeId = request.query.before_id || null;
        if ((until && Number.isNaN(until.getTime())) || (since && until && since >= until) ||
            (before && Number.isNaN(before.getTime())) || (!!before !== !!beforeId) || (beforeId && !isUuid(beforeId)))
            return invalidBody(reply);
        const requestedLimit = Number(request.query.limit ?? 200);
        const limit = Number.isSafeInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 500)
            : 200;
        const result = await app.db.query(`select o.id, o.table_id, o.restaurant_id, o.items, o.status, o.total, o.paid,
              o.paid_at, o.payment_method, o.receipt_number, o.receipt_user, o.item_confirmations, o.cancel_reason, o.accepted_at,
              o.accepted_by, o.completed_at, o.completed_by, o.created_at, o.created_at::text as pagination_created_at,
              payment.bill_total::text as bill_total, payment.cash_received::text as cash_received,
              payment.transfer_amount::text as transfer_amount,
              payment.change_due::text as change_due
       from orders o left join bill_payment_details payment
         on payment.restaurant_id = o.restaurant_id and payment.receipt_number = o.receipt_number
       where o.restaurant_id = $1
         and ($2::boolean is null or o.paid = $2)
         and ($3::order_status[] is null or o.status = any($3))
         and ($4::timestamptz is null or o.created_at >= $4)
         and ($6::timestamptz is null or o.created_at < $6)
         and ($7::timestamptz is null or (o.created_at, o.id) < ($7, $8::uuid))
       order by o.created_at desc, o.id desc
       limit $5`, [
            access.restaurantId,
            paid,
            statuses?.length ? statuses : null,
            since,
            limit + 1,
            until,
            before ? request.query.before : null,
            beforeId,
        ]);
        const rows = result.rows.slice(0, limit);
        const last = rows[rows.length - 1];
        return reply.send({ ok: true, orders: rows, next_cursor: result.rows.length > limit ? {created_at:last.pagination_created_at,id:last.id} : null });
    };
  const patch_api_restaurants_restaurantId_orders_orderId_accept = async (request, reply) => {
        if (!isUuid(request.params.orderId)) return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "cook"]);
        if (!access) return;
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const existing = await client.query("select * from orders where id=$1 and restaurant_id=$2 for update", [request.params.orderId, access.restaurantId]);
            const order = existing.rows[0];
            if (!order) { await client.query("rollback"); return notFound(reply); }
            if (order.status !== "pending") { await client.query("rollback"); return reply.status(409).send({ok:false,error:"INVALID_ORDER_STATE"}); }
            if (order.accepted_at) { await client.query("commit"); return reply.send({ok:true,order}); }
            const result = await client.query("update orders set accepted_at=now(), accepted_by=$3 where id=$1 and restaurant_id=$2 returning *", [order.id,access.restaurantId,access.user.id]);
            await insertAudit(client,access.restaurantId,access.user.id,{action:"order.accept",targetId:order.id,details:{from:"new",to:"cooking"}});
            await client.query("commit");
            return reply.send({ok:true,order:result.rows[0]});
        } catch(error) {
            await client.query("rollback"); request.log.error({err:error},"order acceptance failed");
            return reply.status(500).send({ok:false,error:"ORDER_UPDATE_FAILED"});
        } finally { client.release(); }
    };
  const patch_api_restaurants_restaurantId_orders_orderId_status = async (request, reply) => {
        if (!isUuid(request.params.orderId))
            return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "cook"]);
        if (!access)
            return;
        const nextStatus = request.body?.status;
        const cancelReason = request.body?.cancel_reason?.trim() || null;
        if (!isOrderStatus(nextStatus) || (cancelReason && cancelReason.length > 500)) {
            return invalidBody(reply);
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const existing = await client.query(`select *
         from orders
         where id = $1 and restaurant_id = $2
         for update`, [request.params.orderId, access.restaurantId]);
            const order = existing.rows[0];
            if (!order) {
                await client.query("rollback");
                return notFound(reply);
            }
            // Payment does not finish kitchen work. Paid orders can still be
            // prepared/served, but cancellation must not invalidate a payment.
            if (!isAllowedTransition(order.status, nextStatus) || (order.paid && nextStatus === "cancelled")) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "INVALID_ORDER_STATE" });
            }
            // Repeated clicks or concurrent kitchen screens must not change
            // completion metadata, duplicate stock consumption or audit events.
            if (order.status === nextStatus) {
                await client.query("commit");
                return reply.send({ ok: true, order });
            }
            if (nextStatus === "served" && !order.stock_applied_at) {
                await applyOrderStock(client, order.id, access.restaurantId, access.user.id);
            }
            else if (nextStatus === "cancelled" &&
                order.stock_applied_at &&
                !order.stock_reversed_at) {
                await reverseOrderStock(client, order.id, access.restaurantId, access.user.id);
            }
            const result = await client.query(`update orders set
           status = $3::order_status,
           cancel_reason = case
             when $3::order_status = 'cancelled' then $4
             else null
           end,
           accepted_at = case
             when $3::order_status = 'ready' and accepted_at is null then now()
             else accepted_at
           end,
           accepted_by = case
             when $3::order_status = 'ready' and accepted_by is null then $5
             else accepted_by
           end,
           completed_at = case
             when $3::order_status in ('served', 'cancelled') then now()
             else completed_at
           end,
           completed_by = case
             when $3::order_status in ('served', 'cancelled') then $5
             else completed_by
           end
         where id = $1 and restaurant_id = $2
         returning *`, [
                order.id,
                access.restaurantId,
                nextStatus,
                cancelReason,
                access.user.id,
            ]);
            await insertAudit(client, access.restaurantId, access.user.id, {
                action: nextStatus === "cancelled"
                    ? "order.cancel"
                    : nextStatus === "served"
                        ? "order.served"
                        : "order.status",
                targetId: order.id,
                details: { from: order.status, to: nextStatus, cancel_reason: cancelReason },
            });
            await client.query("commit");
            return reply.send({ ok: true, order: result.rows[0] });
        }
        catch (error) {
            await client.query("rollback");
            if (isDatabaseMessage(error, "INSUFFICIENT_STOCK")) {
                return reply.status(409).send({ ok: false, error: "INSUFFICIENT_STOCK" });
            }
            request.log.error({ err: error }, "order status update failed");
            return reply.status(500).send({ ok: false, error: "ORDER_UPDATE_FAILED" });
        }
        finally {
            client.release();
        }
    };
  const patch_api_restaurants_restaurantId_orders_orderId_items = async (request, reply) => {
        if (!isUuid(request.params.orderId))
            return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "cook"]);
        if (!access)
            return;
        const items = validateItems(request.body?.items);
        if (!items)
            return invalidBody(reply);
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const orderResult = await client.query(`select status, paid, item_confirmations from orders
         where id = $1 and restaurant_id = $2 for update`, [request.params.orderId, access.restaurantId]);
            const order = orderResult.rows[0];
            if (!order) {
                await client.query("rollback");
                return notFound(reply);
            }
            if (Object.keys(order.item_confirmations).length) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "ORDER_ITEMS_CONFIRMED" });
            }
            if (order.paid || !["pending", "ready"].includes(order.status)) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "INVALID_ORDER_STATE" });
            }
            const priced = await priceItems(client, access.restaurantId, items);
            const result = await client.query(`update orders set items = $3::jsonb, total = $4
         where id = $1 and restaurant_id = $2
         returning *`, [
                request.params.orderId,
                access.restaurantId,
                JSON.stringify(priced.items),
                priced.total,
            ]);
            await insertAudit(client, access.restaurantId, access.user.id, {
                action: "order.edit",
                targetId: request.params.orderId,
                details: { total: priced.total, item_count: priced.items.length },
            });
            await client.query("commit");
            return reply.send({ ok: true, order: result.rows[0] });
        }
        catch (error) {
            await client.query("rollback");
            if (error instanceof OrderRouteError) {
                return reply.status(error.status).send({ ok: false, error: error.code });
            }
            throw error;
        }
        finally {
            client.release();
        }
    };
  const post_api_restaurants_restaurantId_tables_tableId_request_check = async (request, reply) => {
        if (!isUuid(request.params.tableId)) return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "waiter", "staff"]);
        if (!access) return;
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const table = await lockRestaurantTable(client, request.params.tableId, access.restaurantId);
            if (!table) { await client.query("rollback"); return notFound(reply); }
            const unpaid = await client.query(`select id, receipt_number from orders
              where restaurant_id=$1 and table_id=$2 and paid=false and status<>'cancelled'
              order by created_at, id for update`,
              [access.restaurantId, table.id]);
            if (!unpaid.rows.length) { await client.query("rollback"); return reply.status(409).send({ ok:false, error:"NO_UNPAID_ORDERS" }); }
            const receiptNumber = unpaid.rows.find(order => order.receipt_number)?.receipt_number
                || (await client.query("select 'BILL-' || lpad(nextval('receipt_number_seq')::text, 8, '0') as number")).rows[0].number;
            await client.query(`update orders set receipt_number=coalesce(receipt_number,$3)
              where restaurant_id=$1 and table_id=$2 and id=any($4::uuid[])`,
              [access.restaurantId, table.id, receiptNumber, unpaid.rows.map(order => order.id)]);
            await client.query(`update tables set bill_check_requested_at=now(), bill_check_requested_by=$3
              where id=$1 and restaurant_id=$2`, [table.id, access.restaurantId, access.user.id]);
            await insertAudit(client, access.restaurantId, access.user.id, {
                action: "bill.check_requested", targetId: table.id, details: { receipt_number: receiptNumber },
            });
            await client.query("commit");
            return reply.send({ ok:true, table_id:table.id, receipt_number:receiptNumber, bill_check_requested_at:new Date().toISOString() });
        } catch (error) {
            await client.query("rollback");
            request.log.error({ err:error }, "bill check request failed");
            return reply.status(500).send({ ok:false, error:"BILL_CHECK_REQUEST_FAILED" });
        } finally { client.release(); }
  };
  const post_api_restaurants_restaurantId_tables_tableId_settle = async (request, reply) => {
        if (!isUuid(request.params.tableId))
            return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "waiter", "staff"]);
        if (!access)
            return;
        const method = request.body?.payment_method?.trim() ?? "";
        if (!["cash", "transfer", "promptpay", "card", "other", "mixed"].includes(method)) {
            return invalidBody(reply);
        }
        const requestedCashReceived = request.body?.cash_received;
        if (requestedCashReceived !== undefined && (typeof requestedCashReceived !== "number" || !Number.isFinite(requestedCashReceived) || requestedCashReceived < 0)) {
            return invalidBody(reply);
        }
        const requestedTransferAmount = request.body?.transfer_amount;
        if (requestedTransferAmount !== undefined && (typeof requestedTransferAmount !== "number" || !Number.isFinite(requestedTransferAmount) || requestedTransferAmount < 0)) {
            return invalidBody(reply);
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const table = await lockRestaurantTable(client, request.params.tableId, access.restaurantId);
            if (!table) {
                await client.query("rollback");
                return notFound(reply);
            }
            const orders = await client.query(`select id, total, receipt_number, stock_applied_at from orders
         where restaurant_id = $1 and table_id = $2
           and paid = false and status <> 'cancelled'
         for update`, [access.restaurantId, table.id]);
            if (!orders.rows.length) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "NO_UNPAID_ORDERS" });
            }
            const bill = await client.query(`select sum(o.total)::numeric subtotal, r.service_charge_pct, r.vat_pct
              from orders o join restaurants r on r.id = o.restaurant_id
              where o.restaurant_id = $1 and o.table_id = $2 and o.paid = false and o.status <> 'cancelled'
              group by r.service_charge_pct, r.vat_pct`, [access.restaurantId, table.id]);
            const subtotal = Number(bill.rows[0].subtotal);
            const service = Math.round((subtotal * Number(bill.rows[0].service_charge_pct) / 100 + Number.EPSILON) * 100) / 100;
            const vat = Math.round(((subtotal + service) * Number(bill.rows[0].vat_pct) / 100 + Number.EPSILON) * 100) / 100;
            const billTotal = Math.round((subtotal + service + vat + Number.EPSILON) * 100) / 100;
            const transferAmount = method === "mixed"
                ? Math.round((Number(requestedTransferAmount) + Number.EPSILON) * 100) / 100
                : ["transfer", "promptpay"].includes(method)
                    ? Math.round((Number(requestedTransferAmount ?? billTotal) + Number.EPSILON) * 100) / 100
                    : 0;
            const cashReceived = ["cash", "mixed"].includes(method)
                ? Math.round((Number(requestedCashReceived ?? (method === "cash" ? billTotal : 0)) + Number.EPSILON) * 100) / 100
                : null;
            if ((method === "cash" && cashReceived < billTotal) ||
                (method === "mixed" && (transferAmount <= 0 || transferAmount >= billTotal || cashReceived + transferAmount < billTotal)) ||
                (["transfer", "promptpay"].includes(method) && transferAmount !== billTotal)) {
                await client.query("rollback");
                return reply.status(400).send({ ok: false, error: method === "mixed" ? "PAYMENT_SPLIT_INVALID" : "CASH_RECEIVED_TOO_LOW", bill_total: billTotal });
            }
            const changeDue = ["cash", "mixed"].includes(method)
                ? Math.round((cashReceived + transferAmount - billTotal + Number.EPSILON) * 100) / 100
                : 0;
            const ids = orders.rows.map((order) => order.id);
            const receiptNumber = orders.rows.find(order => order.receipt_number)?.receipt_number
                || (await client.query("select 'BILL-' || lpad(nextval('receipt_number_seq')::text, 8, '0') as number")).rows[0].number;
            const operator = await client.query("select email from app_users where id = $1", [access.user.id]);
            await client.query(`insert into bill_payment_details
              (restaurant_id, table_id, receipt_number, payment_method, bill_total, cash_received, change_due, created_by, transfer_amount)
              values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [access.restaurantId, table.id, receiptNumber, method, billTotal, cashReceived, changeDue, access.user.id, transferAmount]);
            // Consume menu and recipe stock at payment time. The same marker
            // keeps the later kitchen completion from consuming it twice.
            for (const order of orders.rows) {
                if (!order.stock_applied_at)
                    await applyOrderStock(client, order.id, access.restaurantId, access.user.id);
            }
            // Allocate the rounded bill amount across orders without losing cents.
            await client.query(`with bill as (
              select sum(o.total) subtotal,r.service_charge_pct,r.vat_pct
              from orders o join restaurants r on r.id=o.restaurant_id
              where o.restaurant_id=$1 and o.id=any($2::uuid[])
              group by r.service_charge_pct,r.vat_pct
            ), charged as (
              select *,subtotal+round(subtotal*service_charge_pct/100,2)
                +round((subtotal+round(subtotal*service_charge_pct/100,2))*vat_pct/100,2) grand from bill
            ), allocations as (
              select o.id,c.service_charge_pct,c.vat_pct,c.grand,
                row_number() over(order by o.id) n,count(*) over() cnt,
                case when c.subtotal>0 then round(c.grand*sum(o.total) over(order by o.id)/c.subtotal,2) else 0 end share
              from orders o cross join charged c where o.restaurant_id=$1 and o.id=any($2::uuid[])
            ), final as (
              select *,share-coalesce(lag(share) over(order by id),0) amount from allocations
            ) update orders o set settled_total=f.amount,settled_service_pct=f.service_charge_pct,settled_vat_pct=f.vat_pct from final f where o.id=f.id`, [access.restaurantId,ids]);
            const updated = await client.query(`update orders
         set paid = true, paid_at = now(), payment_method = $3, receipt_number = coalesce(receipt_number, $4), receipt_user = $5
         where restaurant_id = $1 and id = any($2::uuid[])
         returning *`, [access.restaurantId, ids, method, receiptNumber, operator.rows[0]?.email || access.user.id]);
            await client.query("update tables set is_open = false, bill_check_requested_at = null, bill_check_requested_by = null where id = $1 and restaurant_id = $2", [table.id, access.restaurantId]);
            await insertAudit(client, access.restaurantId, access.user.id, {
                action: "bill.settle",
                targetId: table.id,
                details: {
                    order_ids: ids,
                    method,
                    total: orders.rows.reduce((sum, order) => sum + Number(order.total), 0),
                },
            });
            await client.query("commit");
            return reply.send({ ok: true, orders: updated.rows.map(order => ({ ...order,
                bill_total: billTotal, transfer_amount: transferAmount,
                cash_received: cashReceived, change_due: changeDue,
            })) });
        }
        catch (error) {
            await client.query("rollback");
            request.log.error({ err: error }, "settle failed");
            if (error instanceof OrderRouteError)
                return reply.status(error.status).send({ ok: false, error: error.code });
            if (isDatabaseMessage(error, "INSUFFICIENT_STOCK"))
                return reply.status(409).send({ ok: false, error: "INSUFFICIENT_STOCK" });
            return reply.status(500).send({ ok: false, error: "SETTLE_FAILED" });
        }
        finally {
            client.release();
        }
    };
  const post_api_restaurants_restaurantId_tables_tableId_transfer = async (request, reply) => {
        const toTableId = request.body?.to_table_id ?? "";
        const requestedSources = request.body?.from_table_ids ?? [request.params.tableId];
        if (!Array.isArray(requestedSources) || !requestedSources.length || requestedSources.length > 500 || !requestedSources.every(isUuid))
            return invalidBody(reply);
        const sourceIds = [...new Set(requestedSources)];
        if (!isUuid(request.params.tableId) || !isUuid(toTableId))
            return invalidId(reply);
        if (sourceIds.includes(toTableId) || !sourceIds.includes(request.params.tableId))
            return invalidBody(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "waiter", "staff"]);
        if (!access)
            return;
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const tables = await client.query(`select id from tables
         where restaurant_id = $1 and id = any($2::uuid[])
         order by id for update`, [access.restaurantId, [...sourceIds, toTableId]]);
            if (tables.rows.length !== sourceIds.length + 1) {
                await client.query("rollback");
                return notFound(reply);
            }
            const moved = await client.query(`update orders set table_id = $3
         where restaurant_id = $1 and table_id = any($2::uuid[])
           and paid = false and status <> 'cancelled'
         returning id`, [access.restaurantId, sourceIds, toTableId]);
            if (!moved.rows.length) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "NO_UNPAID_ORDERS" });
            }
            await client.query(`update tables set is_open = (id = $2)
         where restaurant_id = $1 and id = any($3::uuid[])`, [access.restaurantId, toTableId, [...sourceIds, toTableId]]);
            await insertAudit(client, access.restaurantId, access.user.id, {
                action: "bill.transfer",
                targetId: request.params.tableId,
                details: { from_table_ids: sourceIds, to_table_id: toTableId, order_ids: moved.rows.map((row) => row.id) },
            });
            await client.query("commit");
            return reply.send({ ok: true, movedOrderIds: moved.rows.map((row) => row.id) });
        }
        catch (error) {
            await client.query("rollback");
            request.log.error({ err: error }, "transfer failed");
            return reply.status(500).send({ ok: false, error: "TRANSFER_FAILED" });
        }
        finally {
            client.release();
        }
    };
  const post_api_restaurants_restaurantId_bills_receiptNumber_reopen = async (request, reply) => {
        const receiptNumber = String(request.params.receiptNumber ?? "").trim();
        if (!receiptNumber || receiptNumber.length > 100 || !/^[A-Za-z0-9_-]+$/.test(receiptNumber))
            return invalidBody(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "waiter", "staff"]);
        if (!access)
            return;
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const paidOrders = await client.query(`select id, table_id, payment_method, total
              from orders where restaurant_id = $1 and receipt_number = $2 and paid = true
              order by id for update`, [access.restaurantId, receiptNumber]);
            if (!paidOrders.rows.length) {
                await client.query("rollback");
                return reply.status(404).send({ ok: false, error: "PAID_BILL_NOT_FOUND" });
            }
            const tableId = paidOrders.rows[0].table_id;
            if (paidOrders.rows.some((order) => order.table_id !== tableId)) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "BILL_TABLE_MISMATCH" });
            }
            const table = await lockRestaurantTable(client, tableId, access.restaurantId);
            if (!table) {
                await client.query("rollback");
                return notFound(reply);
            }
            const active = await client.query(`select 1 from orders
              where restaurant_id = $1 and table_id = $2 and paid = false and status <> 'cancelled'
              limit 1`, [access.restaurantId, tableId]);
            if (table.is_open || active.rows.length) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "TABLE_ALREADY_OPEN" });
            }
            const ids = paidOrders.rows.map((order) => order.id);
            const reopened = await client.query(`update orders set
                paid = false, paid_at = null, payment_method = null, receipt_number = null,
                receipt_user = null, settled_total = null, settled_service_pct = null, settled_vat_pct = null
              where restaurant_id = $1 and id = any($2::uuid[]) returning *`, [access.restaurantId, ids]);
            await client.query(`update bill_payment_details set reopened_at = now(), reopened_by = $3
              where restaurant_id = $1 and receipt_number = $2 and reopened_at is null`, [access.restaurantId, receiptNumber, access.user.id]);
            await client.query("update tables set is_open = true, bill_check_requested_at = null, bill_check_requested_by = null where id = $1 and restaurant_id = $2", [tableId, access.restaurantId]);
            await insertAudit(client, access.restaurantId, access.user.id, {
                action: "bill.reopen",
                targetId: tableId,
                details: { receipt_number: receiptNumber, order_ids: ids, payment_method: paidOrders.rows[0].payment_method,
                    original_total: paidOrders.rows.reduce((sum, order) => sum + Number(order.total), 0) },
            });
            await client.query("commit");
            return reply.send({ ok: true, receipt_number: receiptNumber, table_id: tableId, orders: reopened.rows });
        }
        catch (error) {
            await client.query("rollback");
            request.log.error({ err: error }, "bill reopen failed");
            return reply.status(500).send({ ok: false, error: "BILL_REOPEN_FAILED" });
        }
        finally {
            client.release();
        }
    };
  const get_api_restaurants_restaurantId_call_staff = async (request, reply) => {
        const access = await requireValidAccess(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select c.*, t.table_number, z.name as zone_name
         from call_staff_requests c
         join tables t on t.id = c.table_id
         left join table_zones z on z.id = t.zone_id
         where c.restaurant_id = $1
           and (c.acknowledged = false or not exists (
             select 1 from call_staff_requests newer
             where newer.restaurant_id = c.restaurant_id
               and newer.table_id = c.table_id
               and newer.acknowledged = true
               and newer.created_at > c.created_at
           ))
         order by c.created_at`, [access.restaurantId]);
        return reply.send({ ok: true, requests: result.rows });
    };
  const patch_api_restaurants_restaurantId_call_staff_requestId_ack = async (request, reply) => {
        if (!isUuid(request.params.requestId))
            return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "waiter", "staff"]);
        if (!access)
            return;
        const result = await app.db.query(`update call_staff_requests set acknowledged = true
       where id = $1 and restaurant_id = $2 returning *`, [request.params.requestId, access.restaurantId]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true, request: result.rows[0] });
    };
  return { get_api_restaurants_restaurantId_orders, patch_api_restaurants_restaurantId_orders_orderId_accept, patch_api_restaurants_restaurantId_orders_orderId_status, patch_api_restaurants_restaurantId_orders_orderId_items, post_api_restaurants_restaurantId_tables_tableId_request_check, post_api_restaurants_restaurantId_tables_tableId_settle, post_api_restaurants_restaurantId_bills_receiptNumber_reopen, post_api_restaurants_restaurantId_tables_tableId_transfer, get_api_restaurants_restaurantId_call_staff, patch_api_restaurants_restaurantId_call_staff_requestId_ack };
}

async function applyOrderStock(client, orderId, restaurantId, actorUserId) {
    // Tracked menu stock is separate from recipe inventory. Consume it when
    // the order is completed, in the same transaction as recipe consumption.
    const menuStock = await client.query(`select m.id, sum(lines.qty)::text as quantity
     from orders o
     cross join lateral jsonb_to_recordset(o.items)
       as lines(menu_id uuid, qty numeric)
     join menus m on m.id = lines.menu_id and m.restaurant_id = o.restaurant_id
     where o.id = $1 and o.restaurant_id = $2 and m.track_stock = true
     group by m.id order by m.id`, [orderId, restaurantId]);
    for (const item of menuStock.rows) {
        const updated = await client.query(`update menus
         set stock_quantity = stock_quantity - $3::numeric
         where id = $1 and restaurant_id = $2 and track_stock = true
           and stock_quantity >= $3::numeric returning *`, [item.id, restaurantId, item.quantity]);
        if (updated.rowCount !== 1)
            throw new Error("INSUFFICIENT_STOCK");
        await recordOrderMenuMovement(client, restaurantId, orderId, actorUserId, updated.rows[0], Number(item.quantity));
    }
    const components = await client.query(`select mic.inventory_item_id,
            sum(mic.quantity * lines.qty)::text as quantity
     from orders o
     cross join lateral jsonb_to_recordset(o.items)
       as lines(menu_id uuid, qty numeric)
     join menu_inventory_components mic on mic.menu_id = lines.menu_id
     where o.id = $1 and o.restaurant_id = $2
     group by mic.inventory_item_id`, [orderId, restaurantId]);
    let locationId = null;
    if (components.rows.length) {
        const location = await client.query(`select id from stock_locations
         where restaurant_id = $1 and is_default = true and active = true
         limit 1`, [restaurantId]);
        locationId = location.rows[0]?.id;
        if (!locationId)
            throw new OrderRouteError(409, "DEFAULT_STOCK_LOCATION_MISSING");
    }
    for (const component of components.rows) {
        await client.query(`insert into stock_movements
        (restaurant_id, inventory_item_id, location_id, movement_type,
         quantity_delta, reference_type, reference_id, idempotency_key,
         note, actor_user_id)
       values ($1,$2,$3,'recipe_consumption',$4,'order',$5,$6,$7,$8)
       on conflict (restaurant_id, idempotency_key)
         where idempotency_key is not null
       do nothing`, [
            restaurantId,
            component.inventory_item_id,
            locationId,
            -Number(component.quantity),
            orderId,
            `order:${orderId}:consume:${component.inventory_item_id}`,
            "Order stock consumption",
            actorUserId,
        ]);
    }
    await client.query("update orders set stock_applied_at = now() where id = $1", [orderId]);
    await insertAudit(client, restaurantId, actorUserId, {action:'order.stock_applied',targetId:orderId,details:{snapshot_version:1}});
}
async function reverseOrderStock(client, orderId, restaurantId, actorUserId) {
    // Restore tracked menu stock if a completed order is cancelled.
    const recorded = await client.query(`select target_id as id, details->>'quantity' as quantity from audit_logs
        where restaurant_id=$1 and action='menu.stock_sale' and details->>'order_id'=$2 order by target_id`, [restaurantId, orderId]);
    const hasSnapshot = (await client.query(`select 1 from audit_logs where restaurant_id=$1 and target_id=$2 and action='order.stock_applied' limit 1`,[restaurantId,orderId])).rowCount>0;
    const menuStock = hasSnapshot || recorded.rows.length ? recorded : await client.query(`select m.id, sum(lines.qty)::text as quantity
     from orders o
     cross join lateral jsonb_to_recordset(o.items)
       as lines(menu_id uuid, qty numeric)
     join menus m on m.id = lines.menu_id and m.restaurant_id = o.restaurant_id
     where o.id = $1 and o.restaurant_id = $2
     group by m.id`, [orderId, restaurantId]);
    for (const item of menuStock.rows) {
        const updated = await client.query(`update menus set stock_quantity = stock_quantity + $3::numeric
         where id = $1 and restaurant_id = $2 returning *`, [item.id, restaurantId, item.quantity]);
        if (updated.rows[0]) await recordOrderMenuMovement(client, restaurantId, orderId, actorUserId, updated.rows[0], Number(item.quantity), true);
    }
    const movements = await client.query(`select inventory_item_id, location_id, quantity_delta::text
     from stock_movements
     where restaurant_id = $1 and reference_type = 'order' and reference_id = $2
       and movement_type = 'recipe_consumption'`, [restaurantId, orderId]);
    for (const movement of movements.rows) {
        await client.query(`insert into stock_movements
        (restaurant_id, inventory_item_id, location_id, movement_type,
         quantity_delta, reference_type, reference_id, idempotency_key,
         note, actor_user_id)
       values ($1,$2,$3,'return_in',$4,'order',$5,$6,$7,$8)
       on conflict (restaurant_id, idempotency_key)
         where idempotency_key is not null
       do nothing`, [
            restaurantId,
            movement.inventory_item_id,
            movement.location_id,
            -Number(movement.quantity_delta),
            orderId,
            `order:${orderId}:reverse:${movement.inventory_item_id}`,
            "Cancelled order stock reversal",
            actorUserId,
        ]);
    }
    await client.query("update orders set stock_reversed_at = now() where id = $1", [orderId]);
}
async function priceItems(client, restaurantId, items) {
    const menuIds = [...new Set(items.map((item) => item.menu_id))];
    const menus = await client.query(`select id, name, name_lo, name_en, price, available from menus
     where restaurant_id = $1 and id = any($2::uuid[])`, [restaurantId, menuIds]);
    const map = new Map((menus.rows as MenuPriceRow[]).map((menu) => [menu.id, menu]));
    let total = 0;
    const snapshot = items.map((item) => {
        const menu = map.get(item.menu_id);
        if (!menu || !menu.available)
            throw new OrderRouteError(409, "MENU_UNAVAILABLE");
        const unitPrice = Number(menu.price);
        total += unitPrice * item.qty;
        return {
            menu_id: menu.id,
            qty: item.qty,
            ...(item.note ? { note: item.note } : {}),
            name: menu.name,
            name_lo: menu.name_lo,
            name_en: menu.name_en,
            unit_price: unitPrice,
        };
    });
    return { items: snapshot, total };
}
function validateItems(input) {
    if (!Array.isArray(input) || input.length === 0 || input.length > 50)
        return null;
    const result = [];
    for (const item of input) {
        const menuId = item.menu_id?.trim() ?? "";
        const qty = item.qty;
        const note = item.note?.trim() || null;
        if (!isUuid(menuId) || !Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
            return null;
        }
        if (note && note.length > 300)
            return null;
        result.push({ menu_id: menuId, qty: qty, note });
    }
    return result;
}
async function lockRestaurantTable(client, tableId, restaurantId) {
    const result = await client.query("select id from tables where id = $1 and restaurant_id = $2 for update", [tableId, restaurantId]);
    return result.rows[0] ?? null;
}
async function insertAudit(client, restaurantId, userId, event) {
    await client.query(`insert into audit_logs
      (restaurant_id, actor_user_id, action, target_id, details)
     values ($1,$2,$3,$4,$5::jsonb)`, [
        restaurantId,
        userId,
        event.action,
        event.targetId,
        JSON.stringify(event.details),
    ]);
}
async function requireValidAccess(_app, request, reply, env) {
    if (!isUuid(request.params.restaurantId)) {
        invalidId(reply);
        return null;
    }
    return requireRestaurantAccess(request, reply, env, request.params.restaurantId);
}
function isAllowedTransition(current, next) {
    if (current === next)
        return true;
    if (current === "pending")
        return ["ready", "served", "cancelled"].includes(next);
    if (current === "ready")
        return ["served", "cancelled"].includes(next);
    return false;
}
function isOrderStatus(value) {
    return Boolean(value && ["pending", "ready", "served", "cancelled"].includes(value));
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isDatabaseMessage(error, message) {
    return error instanceof Error && error.message.includes(message);
}
function invalidId(reply) {
    return reply.status(400).send({ ok: false, error: "INVALID_ID" });
}
function invalidBody(reply) {
    return reply.status(400).send({ ok: false, error: "INVALID_BODY" });
}
function notFound(reply) {
    return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
}
class OrderRouteError extends Error {
    status;
    code;
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}
