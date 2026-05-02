"use client";

import { useState } from "react";

export default function MainHeaderClient() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (e) {
      console.error("Logout failed:", e);
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-red-500 hover:text-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoggingOut ? "Se deconectează..." : "Deconectare"}
    </button>
  );
}
