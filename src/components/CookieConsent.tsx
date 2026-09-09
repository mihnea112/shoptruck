"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const COOKIE_KEY = "shoptruck_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage not available
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_KEY, "accepted");
    } catch {}
    setVisible(false);
  };

  const decline = () => {
    try {
      localStorage.setItem(COOKIE_KEY, "declined");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-lg p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 text-sm text-slate-700">
          <p>
            🍪 Acest site folosește cookie-uri pentru a îmbunătăți experiența
            de navigare. Citește{" "}
            <Link
              href="/cookies"
              className="text-amber-600 hover:text-amber-500 font-medium underline"
            >
              Politica de cookie-uri
            </Link>{" "}
            și{" "}
            <Link
              href="/privacy"
              className="text-amber-600 hover:text-amber-500 font-medium underline"
            >
              Politica de confidențialitate
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={decline}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Refuz
          </button>
          <button
            onClick={accept}
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 transition cursor-pointer"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
