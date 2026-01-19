// src/app/login/page.tsx
import LoginClient from "./LoginClient";

function safeNext(v: unknown): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  const next = typeof raw === "string" ? raw : null;
  if (!next) return null;
  // allow only internal redirects
  if (!next.startsWith("/")) return null;
  // optional: prevent redirect loops or weird paths
  if (next.startsWith("//")) return null;
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const initialNext = safeNext(sp?.next);
  return <LoginClient initialNext={initialNext} />;
}