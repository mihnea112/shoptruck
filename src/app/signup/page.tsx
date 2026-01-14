// src/app/register/page.tsx
import SignupClient from "./SignupClient";

function safeNext(v: unknown): string | null {
  const next = typeof v === "string" ? v : null;
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const initialNext = safeNext(searchParams?.next);
  return <SignupClient initialNext={initialNext} />;
}