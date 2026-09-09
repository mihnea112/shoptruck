"use client";

import { useState } from "react";

type Props = {
  mainImage: string;
  thumbs: string[];
  productName: string;
};

export function ProductImageGallery({ mainImage, thumbs, productName }: Props) {
  const [selected, setSelected] = useState(mainImage);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        {/* Main image */}
        <div
          className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm aspect-[5/4] relative group cursor-zoom-in"
          onClick={() => setFullscreen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected}
            alt={productName}
            className="w-full h-full object-contain"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition">
            <div className="rounded-full bg-white/80 p-2.5 opacity-0 group-hover:opacity-100 transition shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
          </div>
        </div>

        {/* Thumbnails */}
        {thumbs.length > 1 && (
          <div className="grid grid-cols-6 gap-2">
            {thumbs.map((u) => (
              <button
                key={u}
                onClick={() => setSelected(u)}
                className={`overflow-hidden rounded-xl border bg-white aspect-[5/4] transition ${
                  selected === u
                    ? "border-[#feab1f] ring-2 ring-[#feab1f]/30"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt="Imagine produs"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen lightbox */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Navigation arrows */}
          {thumbs.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = thumbs.indexOf(selected);
                  setSelected(thumbs[(idx - 1 + thumbs.length) % thumbs.length]);
                }}
                className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = thumbs.indexOf(selected);
                  setSelected(thumbs[(idx + 1) % thumbs.length]);
                }}
                className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected}
            alt={productName}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Thumbnail strip at bottom */}
          {thumbs.length > 1 && (
            <div
              className="absolute bottom-4 flex gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {thumbs.map((u) => (
                <button
                  key={u}
                  onClick={() => setSelected(u)}
                  className={`h-14 w-14 overflow-hidden rounded-lg border-2 transition ${
                    selected === u
                      ? "border-white"
                      : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt="Imagine produs"
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
