# Frontend source layout

`main.tsx` is the React entry point. `app/` contains routes, layout, and
application wiring. Each migrated screen has its own folder under `pages/`;
`shared/` contains reusable API and UI utilities, and `features/` is for
business logic shared by multiple screens.

React pages and components use `.tsx`; hooks, API clients, types, and utilities
use `.ts`. Page styling belongs in Tailwind utility classes. `styles.css` is the
small global Tailwind entry point and base-style file, not a place for page
layouts. There are no page-specific CSS files.

## Page migration status

The original restaurant application is the only dashboard UI. Dashboard links
must stay in that UI when changing routes; do not add a `?ui=source` switch that
can send users to a second layout. Keep the legacy HTML and its assets when
building; they are required at runtime.

`/dashboard` opens `/dashboard/close-shop`, which is the default dashboard
entry page.

These TypeScript pages are migration work and are not routed as dashboard pages:

| Screen | Source module |
| --- | --- |
| Audit | `pages/audit/AuditPage.tsx` |
| Authentication | `pages/auth/` |
| Backoffice overview | `pages/backoffice/BackofficePage.tsx` |
| Bills | `pages/bills/BillsPage.tsx` |
| Categories | `pages/categories/CategoriesPage.tsx` |
| Close shop | `pages/close-shop/CloseShopPage.tsx` |
| Customer menu | `pages/customer-menu/CustomerMenuPage.tsx` |
| Dashboard home | `pages/dashboard/DashboardHomePage.tsx` |
| Feedback | `pages/feedback/FeedbackPage.tsx` |
| Finance | `pages/finance/FinancePage.tsx` |
| Inventory | `pages/inventory/InventoryPage.tsx` |
| Kitchen | `pages/kitchen/KitchenPage.tsx` |
| Menu management | `pages/menu/MenuPage.tsx` |
| Promotions | `pages/promotions/PromotionsPage.tsx` |
| Settings | `pages/settings/SettingsPage.tsx` |
| Staff order entry | `pages/staff-order/StaffOrderPage.tsx` |
| Statistics | `pages/statistics/StatsPage.tsx` |
| Tables | `pages/tables/TablesPage.tsx` |

Dashboard destinations continue to load through the compatibility iframe. It
loads `dist/legacy-app.html` and its bundles from `dist/assets/`.

The source Kitchen page includes live order polling, status changes, item
confirmation and editing, cancellation, history, CSV export, and browser
printing. The previous WebUSB/WebBluetooth auto-print integrations still need
to be ported before the kitchen printer workflow is fully migrated.

The source Inventory page separates item setup, manual stock movements, movement
history, and menu recipe configuration into modules in `pages/inventory/`. The
specialized image-upload flow from the old screen is not yet included; item
images can currently be set by URL.

The customer menu is served directly at `/t/:shortCode`. It loads public menu
data, promotions, table orders, and sends order and staff-call requests through
the public API. The old customer menu's specialized style assets have not been
ported; the new page uses Tailwind classes.

The source Bills page covers unpaid and recent settled orders, staff calls,
payment recording, and moving unpaid orders between tables. Receipt printer
customization and receipt reprints from the old bill screen have not yet been
ported.

Use `npm run typecheck` and `npm run build` to verify the source and production
bundle.
