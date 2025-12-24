"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "./logo.png";

const navItems = [
  { href: "/", label: "Acasă" },
  { href: "/promotii", label: "Promoții" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function MainHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 gap-6">
        {/* Logo + brand */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={logo}
            alt="ShopTruck logo"
            className="h-10 w-auto"
          />
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  active
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/cos"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900 transition"
          >
            Coș
          </Link>
          <Link
            href="/cont"
            className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-300 transition"
          >
            Contul meu
          </Link>
        </div>
      </div>
    </header>
  );
}