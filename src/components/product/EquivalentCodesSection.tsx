"use client";

import { useState } from "react";

interface EquivalentCodesSectionProps {
  codes: string[];
}

export function EquivalentCodesSection({ codes }: EquivalentCodesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasCodes = codes && codes.length > 0;

  return (
    <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
      {hasCodes ? (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Coduri Echivalente ({codes.length})
            </h2>
            <svg
              className={`w-5 h-5 text-slate-500 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>

          {isExpanded && (
            <div className="grid gap-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
              {codes.map((code, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center hover:bg-slate-100 transition"
                >
                  <div className="font-mono text-xs font-semibold text-slate-900 break-all">
                    {code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-6 text-slate-500">
          <p className="text-sm">Nu exista coduri echivalente pentru acest produs</p>
        </div>
      )}
    </div>
  );
}
