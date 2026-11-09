import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  checkPassword,
  createSessionToken,
  isAdminConfigured,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return Response.json({ error: "Admin is not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 1000));
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }

  (await cookies()).set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return Response.json({ ok: true });
}
