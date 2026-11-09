# Self-hosted PostgreSQL migrations

These migrations build the replacement for Supabase's PostgreSQL schema. They
do not read, modify, or delete the existing Supabase project.

## Local setup

1. Create the `shopqr` database and the non-superuser `shopqr_app` role.
2. Add a URL-encoded connection string to `backend/.env`:

   ```env
   DATABASE_URL=postgresql://shopqr_app:CHANGE-ME@127.0.0.1:5432/shopqr
   DATABASE_SSL=false
   ```

3. Run:

   ```bash
npm run db:migrate
```

## Migrating existing Supabase data

Run the migration tool without arguments first. Its default mode is read-only:

```bash
npm run db:migrate:supabase
```

The dry run reads source row counts, validates JSON fields, reports any
compatibility repairs, and checks that the PostgreSQL business tables are
empty. It never writes to either database.

Only after reviewing the dry-run output, import in one PostgreSQL transaction:

```bash
npm run db:migrate:supabase -- --apply
```

The import preserves UUIDs and image URLs. It never deletes or updates
Supabase. Supabase Auth password hashes are not exposed by its Admin API, so
imported users must set a new password before self-hosted login is enabled.

The runner records each applied file in `schema_migrations`. Never edit an
already-applied migration; add a new numbered migration instead.

## Production

- Keep PostgreSQL on a private network or localhost. Do not expose port 5432.
- Set `DATABASE_SSL=true` when the application connects over a network.
- Keep `DATABASE_SSL_REJECT_UNAUTHORIZED=true` with a trusted certificate.
- Back up the database before every migration and test restore procedures.
- Run the application with `shopqr_app`, never the `postgres` superuser.

## Supabase cutover

Do not run `backend/supabase/setup_all.sql` on this database. It references
Supabase-owned schemas such as `auth`, `storage`, and `supabase_realtime`.
Data export/import will be handled separately after the API and authentication
replacement are ready.
