alter table pro_requests add column cancelled_at timestamptz;
alter table pro_requests add column cancelled_by uuid references app_users(id);
alter table pro_requests add column cancellation_reason text not null default '' check (length(cancellation_reason) <= 1000);
alter table pro_requests add constraint pro_requests_cancellation_consistency check (
  (cancelled_at is null and cancelled_by is null and cancellation_reason = '') or
  (status = 'approved' and cancelled_at is not null and cancelled_by is not null and length(cancellation_reason) > 0)
);
