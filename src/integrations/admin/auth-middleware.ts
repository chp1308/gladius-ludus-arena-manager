import { createMiddleware } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";

// Admin auth is intentionally separate from player Supabase auth — a single
// shared name+password credential (env vars, not a DB row), sealed into a
// signed HttpOnly cookie via h3's built-in session helper. No Supabase user,
// no admin flag on profiles, no new migration.
export const ADMIN_SESSION_CONFIG = {
  name: "gladius_admin_session",
  password: process.env.ADMIN_SESSION_SECRET ?? "",
  maxAge: 60 * 60 * 12, // 12h
};

function assertConfigured() {
  const missing = [
    ...(!process.env.ADMIN_USERNAME ? ["ADMIN_USERNAME"] : []),
    ...(!process.env.ADMIN_PASSWORD ? ["ADMIN_PASSWORD"] : []),
    ...(!process.env.ADMIN_SESSION_SECRET ? ["ADMIN_SESSION_SECRET"] : []),
  ];
  if (missing.length > 0) {
    throw new Error(`Missing admin environment variable(s): ${missing.join(", ")}. Set them in .env.`);
  }
}

export const requireAdminAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    assertConfigured();
    const session = await getSession<{ authenticated?: boolean }>(ADMIN_SESSION_CONFIG);
    if (!session.data?.authenticated) throw new Error("Unauthorized");
    return next({ context: {} });
  },
);

export { assertConfigured as assertAdminConfigured };
