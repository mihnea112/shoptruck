// src/app/login/page.tsx
import LoginClient from "./LoginClient";

function safeNext(v: unknown): string | null {
  const next = typeof v === "string" ? v : null;
  if (!next) return null;
  // allow only internal redirects
  if (!next.startsWith("/")) return null;
  // optional: prevent redirect loops or weird paths
  if (next.startsWith("//")) return null;
  return next;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const initialNext = safeNext(searchParams?.next);
  return <LoginClient initialNext={initialNext} />;
}