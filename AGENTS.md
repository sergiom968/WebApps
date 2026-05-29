# AGENTS.md

**Monorepo** with two independent vanilla JS SPAs. No shared code.

## Projects

### FinanzApp — personal finance manager
- `FinanzApp/index.html` (main), `last.html` (older backup)
- Supabase (optional) + localStorage (primary). Demo mode (`DS` in-memory) when Supabase unconfigured.
- localStorage keys: `fin_sb_url`, `fin_sb_key`, `fin_dark` (theme), `fw_order`, `fw_vis`, `fw_collapsed` (widgets)
- All UI in Spanish. Currency: COP. `fmt()` formats COP, `fmtInput()` masks input with thousands separators.
- CDN deps: Tailwind CSS + DaisyUI, Chart.js 4.4.2, Supabase JS 2.39.7, Lucide Icons, Google Fonts
- `window.FinanzApp.processAutoCharges` — exposed for external cron/backend integration
- SQL schema: `base\ de\ datos.sql` — 8 tables (categories, accounts, credit_cards, debts, recurring_expenses, budgets, savings_goals, transactions)

### ShifTurnos — shift/work schedule manager
- `ShifTurnos/index.html` (main), `old.html` (older backup)
- Supabase (optional) + localStorage (primary). Demo data loaded when unconfigured.
- localStorage keys: `turnoshift_data`, `turnoshift_config`, `turnoshift_supabase`
- All UI in Spanish. Timezone: America/Bogota.
- CDN deps: Tailwind CSS v3, Supabase JS v2, Material Symbols Rounded, Google Fonts (DM Sans + DM Serif Display)
- Gesture: swipe left/right navigates months on calendar and reports views
- SQL schema: `base\ de\ datos.sql` — 4 tables (turnos, asignaciones, eventos, informes)

## Conventions

- **No build system, no testing, no linting, no CI.** Zero config files. Open files directly or serve with any static server.
- **Single-file architecture** — all HTML, CSS, and JS inline in `index.html`.
- **Dev workflow**: edit `index.html`, refresh browser. `python3 -m http.server 8080` or similar.
- **No package.json** — all deps loaded via CDN `<script>` tags.
- **State persistence**: always writes to localStorage first; syncs to Supabase if connected.
- **Dark mode**: system/light/dark toggle persisted in localStorage.
- **Both apps are single-user** — Supabase RLS disabled, all grants open.
- **Git commits in Spanish.**
