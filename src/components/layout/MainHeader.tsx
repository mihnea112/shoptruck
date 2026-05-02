"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import logo from "./logo.png";

const navItems = [
  { href: "/", label: "Acasă" },
  { href: "/catalog", label: "Catalog" },
  { href: "/promotii", label: "Promoții" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

let cachedAuth: { isLoggedIn: boolean; checkTime: number } | null = null;
const CACHE_DURATION = 60000; // 1 minute

export function MainHeader() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const now = Date.now();

      // Use cache if still valid
      if (
        cachedAuth &&
        now - cachedAuth.checkTime < CACHE_DURATION
      ) {
        setIsLoggedIn(cachedAuth.isLoggedIn);
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        const isLogged = res.ok;
        setIsLoggedIn(isLogged);
        cachedAuth = { isLoggedIn: isLogged, checkTime: now };
      } catch {
        setIsLoggedIn(false);
        cachedAuth = { isLoggedIn: false, checkTime: now };
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      cachedAuth = null; // Clear cache
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white backdrop-blur">
      <div className="flex w-full items-center justify-between px-4 sm:px-6 lg:px-8 py-4 gap-6">
        {/* Logo + brand */}
        <Link href="/" className="flex items-center gap-3">
          <Image src={logo} alt="ShopTruck logo" className="h-10 w-auto" />
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {!isLoading && isLoggedIn ? (
            <>
              <Link
                href="/cos"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900 transition"
              >
                Coș
              </Link>
              <Link
                href="/account"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900 transition"
              >
                Contul meu
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-300 transition"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/cos"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900 transition"
              >
                Coș
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-300 transition"
              >
                Autentifică-te
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
