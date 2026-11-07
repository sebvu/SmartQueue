# QueueSmart database (A4)

The backend now stores everything in **SQLite** (one file: `data/smartqueue.db`, created and filled with the
demo data the first time the app runs). Delete that file and restart to get a fresh copy of the demo data.
The tests use an in-memory database (`SMARTQUEUE_DB=":memory:"`, set in `vitest.config.ts`), so they never touch the file.

## Where things are

| File | What it does |
|---|---|
| `app/lib/server/schema.ts` | The `CREATE TABLE` statements. `docs/schema.sql` is a copy of this text (a test fails if they differ). |
| `app/lib/server/db.ts` | Opens the database, creates the tables, loads the demo data, keeps `queue_entry.position` correct. |
| `app/lib/server/repo.ts` | **Every query lives here.** Routes and services call these functions and never write SQL. |
| `app/lib/server/mockData.ts` | The demo data that seeds a new database. |

## A4 tables

| A4 name | Table | Notes |
|---|---|---|
| UserCredentials | `user_credentials` | email (unique, ignores case), scrypt password hash, `role` USER or ADMIN |
| UserProfile | `user_profile` | full name, email (foreign key), phone, preferences (JSON text) |
| Service | `service` | name, description, expected duration, priority level |
| Queue | `queue` | `service_id` foreign key, status OPEN / CLOSED / INACTIVE, capacity, created date |
| QueueEntry | `queue_entry` | queue, user, `position`, join time, status |
| Notification / History | `notification` | message, timestamp, status SENT / VIEWED. History = finished `queue_entry` rows |

Also: `organization`, `custom_role`, `queue_entry_role`, `admin_permission`, `session`.

The API still shows a service and its queue as one object (`Queue` in `types.ts`); `repo.ts` joins the two tables.

## Adding database code

1. Add a function to `repo.ts` that takes and returns the plain objects from `types.ts`.
2. Call it from your service or route. Use `db.transaction(...)` when a change touches more than one table.
3. The database rejects bad data (missing fields, too-long text, unknown statuses, duplicate emails). A route can
   catch the error and answer 400, like `addQueue` does.
4. Test it in `app/lib/server/` with `beforeEach(() => resetStore())`, which reloads the demo data.

## Changes from A3 worth knowing

- `getStore()` is gone. Use the functions in `repo.ts` instead.
- `/api/userAuth` now hashes passwords (it shares the code behind `/api/auth/*`).
- New: `GET` and `PATCH /api/me/profile`. `/api/auth/me` now includes `role`.
- `serveUser` runs in one transaction (finish the current person and start the next together).
