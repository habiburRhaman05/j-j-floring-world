# J&J Flooring World: team workspace (Next.js)

The J&J Flooring World estimator, invoicing and job workspace, rebuilt as a
Next.js App Router application in TypeScript. Every screen is a direct port of
the original static prototype: the CSS, the class names and the visual design
are unchanged, but the markup is now React components and the data flows
through a typed, backend-ready layer.

This is a **frontend-first** build. There is no backend yet: the seed data set
lives in memory and the UI is complete and working end to end. The API phase
comes next, and the seam for it is already in place (see
[Data layer](#data-layer)).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Signing in

One global sign-in at `/login`. There is no role picker: the role is a
property of the account, so the credentials decide which workspace opens. The
session is held in memory for the life of the tab, so reloading signs you out —
the honest behaviour for a build with no server session yet.

Against the mock API (`NEXT_PUBLIC_USE_MOCK_API` unset) every seeded account
uses the password `jjflooring2026`:

| Email | Opens |
| ----- | ----- |
| `janet.ross@jjflooringworld.com` | Admin |
| `marcus.hale@jjflooringworld.com` | Sales Rep (rep A) |
| `dana.whitfield@jjflooringworld.com` | Sales Rep (rep B) |
| `priya.nair@jjflooringworld.com` | CSR |
| `tony.alvarez@jjflooringworld.com` | Installer (crew 1) |
| `rick.boone@jjflooringworld.com` | Installer (crew 2) |

The same form posts to `POST /auth/login` once a real API is configured.

## Routes

Every destination is its own App Router segment, so the URL always says where
you are and a view can be linked, bookmarked or opened in a new tab.

| Route | Role | Screen |
| ----- | ---- | ------ |
| `/` | — | Forwards to `/login` |
| `/login` | — | The one sign-in for the whole team |
| `/admin` | Admin | Dashboard: revenue, cost, margin, funnel and pipeline charts |
| `/admin/pipeline` | Admin | Sales pipeline kanban, every rep |
| `/admin/jobs` | Admin | Jobs and invoices, installer scheduling, payments |
| `/admin/products` | Admin | Product catalog, cost, price and commission |
| `/admin/team` | Admin | Accounts, sign-in emails and commission rates |
| `/admin/sync` | Admin | GoHighLevel sync log and settings |
| `/sales-rep` | Sales Rep | My pipeline |
| `/sales-rep/estimates` | Sales Rep | Estimates list and the builder |
| `/sales-rep/jobs` | Sales Rep | Won jobs |
| `/sales-rep/calendar` | Sales Rep | Appointments |
| `/sales-rep/commission` | Sales Rep | Own commission |
| `/csr` | CSR | Intake board |
| `/csr/appointments` | CSR | Booked appointments |
| `/installer` | Installer | Today |
| `/installer/jobs` | Installer | My open jobs |
| `/installer/completed` | Installer | Completed installs |

Each role's destinations are declared once, as data, in `src/lib/navigation.ts`.
That role's `layout.tsx` mounts `WorkspaceShell` with them, so the top bar and
the tab strip render once and only the page below swaps out on navigation. The
active tab is derived from the pathname (`activeNavKey`), which is why a deep
link and a browser Back both land on the right tab.

A signed-out visitor to any role route is sent to `/login`; a visitor signed in
with the wrong role is sent to their own workspace rather than being signed out.

## Stack

| Concern | Choice | Why |
| ------- | ------ | --- |
| Framework | Next.js 16 (App Router), React 19 | Typed routes, React Compiler enabled |
| Language | TypeScript, `strict` | The domain model in `src/lib/types.ts` is the contract the UI is built against |
| Styling | Tailwind v4 for the theme map, the design system CSS for the UI | See [Design system](#design-system) |
| Client data | TanStack Query v5 over a repository | One query over a workspace snapshot; mutations invalidate it |
| HTTP | axios | One instance: base URL, timeout, bearer token, error normalisation |
| Tables | TanStack Table v9 | Column/row model and sorting, rendering the project's own grid markup |
| Charts | Chart.js 4 via react-chartjs-2 | The sales funnel and job pipeline are real charts now |
| Primitives | Radix UI, shadcn-style | Dialog, Checkbox, Label, Toast, Slot — plus `cva` and `cn` |
| Fonts | `next/font/google` | Manrope, Libre Baskerville, Caveat, self-hosted as CSS variables |

`components.json` is checked in, so `npx shadcn@latest add <component>` works.
The components under `src/components/ui/` are written the shadcn way — `cva`
variants plus the `cn` helper — but they emit **this project's** class names
(`.btn`, `.input`, `.panel`, `.tile`) rather than Tailwind utilities, which is
what keeps the visual design identical.

## Design system

Colour, elevation, geometry and type live in exactly one place:

```
src/styles/tokens.css       tokens, dark mode, reset, type scale
src/styles/components.css   buttons, cards, pills, tables, kanban, modal, toast
src/styles/layout.css       app shell, top bar, tab strip, sign-in, installer nav
src/app/globals.css         Tailwind entry + the token → utility map
```

`globals.css` maps every brand token onto Tailwind's theme (`--color-brand`,
`--text-ink-2`, `--font-script`, …), so a utility class and a hand-written rule
resolve to the same value. Nothing in the app hard-codes a colour.

The palette is sampled from the live marketing site, not invented; the header
of `tokens.css` records the OKLCH → sRGB conversion for each brand colour. The
three stylesheets are imported in `src/app/layout.tsx` **after** `globals.css`,
so the design system always wins over Tailwind's preflight.

**Typography** is loaded once in the root layout. The font families reach the
CSS as `--font-manrope`, `--font-libre` and `--font-caveat`, so `tokens.css`
never names a font file.

## Data layer

```
src/lib/types.ts              the domain model
src/lib/constants.ts          pipeline stages, catalog enums, stage tones
src/lib/format.ts             money, percentage, quantity and date formatting
src/lib/navigation.ts         the per-role destination map
src/lib/data/pricing.ts       line pricing and tier totals (cost is derived, never stored)
src/lib/data/seed.ts          the seeded demo data set
src/lib/data/selectors.ts     pure derived reporting
src/lib/data/database.ts      the in-memory store and every domain operation
src/lib/data/hooks.ts         the TanStack Query hooks the components consume
src/lib/api/config.ts         base URL, timeout, mock/HTTP switch
src/lib/api/client.ts         the one axios instance (token, errors)
src/lib/api/errors.ts         ApiError: one error shape for the whole app
src/lib/api/endpoints.ts      every path the app calls
src/lib/api/repository.ts     the WorkspaceRepository interface + both implementations
src/lib/auth/auth-service.ts  sign in / sign out, mock and HTTP
src/lib/auth/credentials.ts   demo accounts and the seeded password
```

Components never import axios and never import the mock store. They call
`useAppDb()`, which returns one query over a `WorkspaceRepository` snapshot, and
write through hooks that invalidate that query so all views redraw together —
the same contract the prototype's `renderAll()` had. `useAppStore()` is for the
two flows that need the saved entity back in the same tick (the estimate builder
sends the estimate it just saved); those handlers are `async`, and `Modal`
awaits an action before closing it.

### Pointing it at a real backend

One file decides: `src/lib/api/config.ts`.

```bash
cp .env.example .env.local
```

```ini
NEXT_PUBLIC_API_BASE_URL=https://api.jjflooringworld.com/v1
NEXT_PUBLIC_USE_MOCK_API=false
```

The app then builds `httpRepository` instead of `mockRepository` — same async
interface, one axios call per method through the endpoint map — and
`authService` posts to `/auth/login`. The token from that call is attached as
`Authorization: Bearer …` by a request interceptor, a 401 from any request
drops the session, and every failure arrives at the UI as an `ApiError` with a
`displayMessage` and optional per-field messages, which the sign-in form and
the mutation toasts already render.

Expected shapes:

| Call | Returns |
| ---- | ------- |
| `GET /workspace` | the whole `Database` |
| `POST /auth/login` | `{ token, user, expiresAt }` |
| everything else | the entity the operation touched, or `null` |

When the backend moves to an httpOnly cookie, delete `setAuthToken` and the
bearer header; nothing at a call site changes.

## Permissions

Cost, margin and commission are gated at the **render layer**, not with CSS.
`can.viewCost(role)` is checked before the nodes are built, so in a Sales Rep,
CSR or Installer session those values never enter the DOM. Inspecting the
rendered page in dev tools turns up nothing to unhide, because there is no
hidden element.

The Installer's scope list reads product names, units and quantities only, and
filters strictly on `installerId`, so another crew's job is never built.

## Demo path

1. **CSR** — create a lead, log outreach, book an appointment.
2. **Sales Rep** — open that lead, build an estimate (Good / Better / Best),
   Send, then Open sign sheet, pick a tier, type a name, Sign. A job and an
   invoice are created automatically and the lead moves to Won.
3. **Admin** — Jobs and Invoices, Manage, assign an installer and a date.
4. **Installer** — open the job, confirm materials, add a photo, En Route,
   In Progress, Completed.
5. **Admin** — Mark Paid, then check Sync and Settings for the full event log.

`Account` in the top bar is the way out: it always offers Sign out, and while
the mock API is in use it also lists the seeded accounts so a demo can hop
between the four workspaces without retyping credentials. That half of the
dialog hides itself once a live API is configured. Reset demo data lives in
Admin → Sync and Settings, and on the sign-in screen.

## Project layout

```
src/app/                    routes: login, then one nested tree per role
src/app/admin/              layout + page per destination (pipeline, jobs, …)
src/components/providers/   Query, Session and Toast providers
src/components/layout/      app bar, tab strip, bottom nav, view section, shell
src/components/ui/          shadcn-style primitives bound to the design system
src/components/pipeline/    kanban board, stage select, job rail
src/components/leads/       per-role lead dialogs
src/components/invoice/     line table, summary, invoice dialog
src/components/estimator/   estimate builder, e-signature sheet
src/components/admin/       dashboard, pipeline, jobs, products, team, sync
src/components/sales-rep/   pipeline, estimates, jobs, calendar, commission
src/components/csr/         intake, appointments, new lead
src/components/installer/   job card, detail dialog, photos, status flow
src/lib/api/                axios client, endpoints, errors, repository
src/lib/auth/               auth service, permissions, route map, credentials
src/lib/                    types, constants, formatting, navigation, charts
src/styles/                 the design system (tokens, components, layout)
```

## Known demo simplifications

- The deposit is recorded as paid at signature. A real build waits on a payment
  webhook.
- Photos store a label and a filename, no file upload.
- The session is in memory only: reloading returns you to the sign-in screen.
- Passwords are checked against one shared demo password by the mock auth
  service. A real deployment verifies them server-side and hands back a token.
- The GoHighLevel integration is a stub. `transport()` inside
  `src/lib/data/database.ts` is the only thing that changes when the private
  integration token exists.

The original hand-written HTML/CSS/JS prototype is still in the repository root
(`index.html`, `admin.html`, `sales-rep.html`, `csr.html`, `installer.html`,
`css/`, `js/`) for reference.
