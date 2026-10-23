import { handle, ok } from "@/app/lib/server/http";

// Example route: thin handler, wrapped in handle(). Copy this shape for new endpoints.
export const GET = handle(() => ok({ status: "ok" }));
