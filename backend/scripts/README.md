# Manual backend tools

Existing files retain their names and are grouped by purpose. Scripts previously
located directly under `backend/` now live in the folders below. Update external
shortcuts that refer to their old paths.

| File | npm command from backend/ | Purpose |
| --- | --- | --- |
| `setup/setup-local.cjs` | `npm run setup:local` | Create initial local database, application role and `.env` |
| `data/add-menu-categories.cjs` | `npm run data:add-categories` | Add the script's configured menu categories |
| `data/add-appetizer-menus.cjs` | `npm run data:add-appetizers` | Add the script's sample appetizer menus |
| `data/set-sample-menu-images.cjs` | `npm run data:sample-images` | Assign sample menu images |
| `data/share-menu-details.cjs` | `npm run data:share-details` | Update shared menu descriptions/details |

These tools write data. Review the configured target records before running
them. They are not part of `npm start` or an automatic migration.

Data tools load `backend/.env` using a path relative to the script, so launching
them from another directory still selects the same environment file. Existing
environment variables keep dotenv's normal precedence.

Setup reads the existing PostgreSQL password from the project's `.local`
directory and refuses to overwrite an existing `backend/.env`. Menu image paths
still point to `frontend/dist/images/menu-samples`; shared-details backups still
go to the project's `.local/shared-menu-details` directory.
