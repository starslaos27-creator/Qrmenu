# UI maintenance scripts

Historical scripts are grouped under `maintenance/` by feature. Most modify the
delivered application in `frontend/dist`; some also change backend bundles.
They are not startup steps or a build pipeline. Do not run all scripts together
or automatically reapply one-time patches: their anchors may describe older
versions of the bundles.

The manager sidebar is maintained in `src/components/Sidebar/`. Edit
`manager-navigation.js` and `manager-navigation.css` there. Vite serves those
files directly during development and copies them into `dist/assets/` on build.
The stock-deposits navigation patch script also targets that source folder.

| Folder | Contents |
| --- | --- |
| `maintenance/menu/` | Add/edit forms, layout, language fields, stock badges and visibility |
| `maintenance/tables/` | Table board, actions and side layout |
| `maintenance/navigation/` | Manager navigation |
| `maintenance/stock/` | Stock workspace |
| `maintenance/staff/` | Staff ordering and POS |
| `maintenance/recovery/` | Historical menu rollback |
| `data/` | Thai common and order label reference JSON |

All 20 existing scripts retain their filenames. For example,
`scripts/patch-menu-add-form.cjs` is now
`scripts/maintenance/menu/patch-menu-add-form.cjs`, and
`scripts/fix-menu-status-visibility.cjs` is now
`scripts/maintenance/menu/fix-menu-status-visibility.cjs`.
The label files moved from `scripts/` to `scripts/data/`.
Update any external shortcuts using the old paths.

Paths to the delivered assets and existing `.local` backups resolve relative to
each script, independently of the terminal's working directory. Scripts under
`maintenance/<feature>/` reach frontend assets through `../../../dist` and
project backups through `../../../../.local`.

`maintenance/recovery/rollback-menu.cjs` additionally depends on the original
local session history at its configured absolute path. Moving it does not make
that historical recovery portable.

Use `npm start` from `frontend/` to serve the application. It does not apply
these patches.
