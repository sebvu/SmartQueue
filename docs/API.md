# QueueSmart A3 API reference (read this before writing a route)

Decisions below are final for A3 so everyone builds against the same rules. Change a value in `app/lib/server/config.ts`, not inside a module.

## 1. Response and error format

Every endpoint returns JSON in one of two shapes.

```json
{ "data": { "...": "..." } }
```
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid.", "fields": { "name": "Name is required." } } }
```

`fields` appears only on validation errors. The front end shows `message`, and shows `fields[x]` under input `x`.

| Status | code | When |
|---|---|---|
| 200 / 201 | none | success / created |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` | bad body |
| 401 | `UNAUTHENTICATED` | not logged in (also wrong email or password) |
| 403 | `FORBIDDEN` | logged in but not allowed |
| 404 | `NOT_FOUND` | thing does not exist |
| 409 | `CONFLICT` | state does not allow it (queue full, already in queue, queue closed) |
| 500 | `INTERNAL_ERROR` | unexpected |

## 2. What "logged in" means

A request is logged in if it carries a valid session token, either in the `sq_session` cookie (browser, set by login/register) or an `Authorization: Bearer <token>` header (tests, tools). Tokens live in the in-memory store and last 1 day. Call `requireUser(request)` to get the user or throw 401. Never send a `User` to the client; use `toPublicUser()`.

Roles are derived, not stored: **OWNER** owns the queue's organization, **ADMIN** has an `adminPermissions` row for that queue, everyone else is **USER**. Use `requireQueueAdmin(request, queueId)` or `requireOrgOwner(request, orgId)`.

Demo login for every seeded GENERAL user: password `password123` (for example `sam@example.com`).

## 3. Thresholds (config.ts)

| Rule | Value |
|---|---|
| Names (person, queue, org) | 1 to 100 characters |
| Description | up to 500 |
| Email | valid format, up to 255 |
| Password | 8 to 128 characters |
| Expected duration | 1 to 480 minutes, whole number |
| Max capacity | 1 to 10000, whole number |
| Almost ready | position 2 or lower |
| Session length | 1 day |

Position is 1-based among `WAITING` entries, ordered by highest role `priorityWeight`, then earliest `joinedAt`. Estimated wait = (people ahead + 1 if someone is SERVING) x queue expected duration. Capacity counts entries in WAITING, FIRST_IN_LINE, or SERVING.

## 4. Endpoint list

`A` = admin/owner of that queue, `O` = org owner, `U` = any logged-in user, `-` = public.

| Method and path | Who | Purpose |
|---|---|---|
| GET `/api/health` | - | example, already built |
| POST `/api/auth/register` | - | name, email, password; logs in |
| POST `/api/auth/login` | - | email, password; sets cookie |
| POST `/api/auth/logout` | U | clears session |
| GET `/api/auth/me` | U | current user and their role summary |
| GET `/api/queues` | U | active queues, with `isOpen`, current size |
| GET `/api/queues/:queueId` | U | one queue, with the caller's position if in it |
| POST `/api/queues` | O | create queue |
| PATCH `/api/queues/:queueId` | A | edit fields, open/close, deactivate (`isActive`) |
| GET `/api/queues/:queueId/entries` | A | full line with positions, plus SERVING person |
| POST `/api/queues/:queueId/serve-next` | A | finish SERVING person, promote next WAITING to SERVING |
| DELETE `/api/queues/:queueId/entries/:entryId` | A | remove a user (status REMOVED) |
| POST `/api/queues/:queueId/join` | U | join (409 if closed, inactive, full, or already in) |
| POST `/api/queues/:queueId/leave` | U | leave (status CANCELLED) |
| GET `/api/me/entries` | U | my current entries with position and wait estimate |
| GET `/api/me/history` | U | my COMPLETED, CANCELLED, REMOVED entries |
| GET `/api/me/notifications` | U | my notifications, newest first |
| PATCH `/api/me/notifications/:id` | U | mark read (`{ "isRead": true }`) |
| POST `/api/me/notifications/read-all` | U | mark all read |

## 5. Module split

| Owner | Files | Endpoints |
|---|---|---|
| Jester | `app/lib/server/authService.ts`, `app/api/auth/*` | register, login, logout, me |
| Vanessa | `queueAdminService.ts`, `app/api/queues` (POST, PATCH, entries, serve-next, remove) | admin side |
| Karam | `queueUserService.ts`, join, leave, GET queues, GET queue | user side of the line, wait time, ordering |
| Emokhare | `notificationService.ts`, `app/api/me/*` | entries, history, notifications, and A2 front-end wiring |

## 6. How to write a route

Keep the route thin and put the logic in a plain function in `app/lib/server/` so it can be unit tested.

```ts
// app/api/queues/[queueId]/join/route.ts
import { handle, created } from "@/app/lib/server/http";
import { requireUser } from "@/app/lib/server/auth";
import { joinQueue } from "@/app/lib/server/queueUserService";

export const POST = handle(async (request: Request, ctx: { params: Promise<{ queueId: string }> }) => {
  const user = requireUser(request);
  const { queueId } = await ctx.params; // Next 15+: params is a Promise
  return created(joinQueue(user.userId, queueId));
});
```

Validate bodies with `parseBody(await readJson(request), rules)` (see `validation.ts`). Throw `new ApiError(status, code, message)` for any failure.

## 7. How to write a test

Put `yourModule.test.ts` beside the module. Call `resetStore()` in `beforeEach`. Run `npm test`, or `npm run coverage` (goal: 70 to 80% or higher for your files). Example: `app/lib/server/foundation.test.ts`.

## 8. Shared building blocks

`types.ts`, `mockData.ts`, `store.ts` (`getStore`, `resetStore`, `generateId`), `http.ts`, `validation.ts`, `auth.ts`, `access.ts`, `password.ts`, `queueLogic.ts` (`getWaitingOrder`, `getPosition`, `isAlmostReady`, `estimateWaitMinutes`, `countActiveEntries`), `config.ts`.

## 9. /api/me endpoints (built)

All need login (401 otherwise). Files: `notificationService.ts`, `myEntriesService.ts`, `app/api/me/*`, tests in `myModules.test.ts`.

| Method and path | Returns in `data` |
|---|---|
| GET `/api/me/entries` | array of `{ entry, queue, position, almostReady, estimatedWaitMinutes }`. `position` is null when the person is SERVING. |
| GET `/api/me/history` | array of `{ entry, queue, outcome }`, outcome is `served`, `left`, or `removed`, latest first |
| GET `/api/me/notifications` | array of notifications, newest first |
| PATCH `/api/me/notifications/:id` | body `{ "isRead": true }`, returns the updated notification. 404 if it is not yours. |
| POST `/api/me/notifications/read-all` | `{ updated: <count> }` |

For other modules: call `addNotification(userId, entryId, type, message)` from `notificationService.ts` when something happens to a user (joined, almost ready, served, removed).

## 10. Temporary login (so /api/me can be tried in the browser)

`POST /api/auth/login` with `{ "email": "sam@example.com", "password": "password123" }` sets the session cookie. `POST /api/auth/logout` clears it. `GET /api/auth/me` returns the current user. These are in `tempAuthService.ts` and `app/api/auth/*`. Jester's real auth can replace them (same paths and same response shape).

To try it in the browser, open the app, open DevTools console, and run:
`fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"sam@example.com",password:"password123"})}).then(r=>r.json()).then(console.log)`
Then visit `/api/me/entries`, `/api/me/history`, and `/api/me/notifications`.

## 11. Queues for users (list, details, join, leave)

All need login. Files: `queueUserService.ts`, `app/api/queues/*`, tests in `queueUser.test.ts`. These replace the older `/api/userQueue` route, which wrote to `mockData.ts` directly and trusted a userId from the body.

| Method and path | What it does |
|---|---|
| GET `/api/queues` | active queues with `queueLength`, `estimatedWaitMinutes` (for someone joining now), `isFull`. Closed queues are listed with `isOpen: false`. Deactivated queues are hidden. |
| GET `/api/queues/:queueId` | one queue plus `myEntry` (the caller's entry with position, or null) |
| POST `/api/queues/:queueId/join` | 201 with the new entry. 409 `QUEUE_CLOSED`, `ALREADY_IN_QUEUE`, or `QUEUE_FULL`. 404 if missing or deactivated. New entries have no roles (only staff assign roles). Creates two notifications. |
| POST `/api/queues/:queueId/leave` | sets the entry to CANCELLED. 404 if not in it. 409 if being served. Creates a notification. |

Admin actions (create, edit, open/close, serve next, remove) should go in new files such as `app/api/queues/[queueId]/serve-next/route.ts`. Put a POST for creating queues in `app/api/queues/route.ts` next to the GET.
