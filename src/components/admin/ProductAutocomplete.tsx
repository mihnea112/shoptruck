"use client";

import { useState, useEffect, useRef } from "react";

export type ProductDTO = {
  id: string;
  name: string;
  sku?: string;
  price: number;
  vat_percent: number;
};

interface Props {
  onSelect: (p: ProductDTO) => void;
  placeholder?: string;
}

export default function ProductAutocomplete({ onSelect, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductDTO[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.ok) {
          setResults(data.items);
          setIsOpen(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (p: ProductDTO) => {
    setQuery(p.name); // Afișăm numele selectat
    setIsOpen(false);
    onSelect(p); // Trimitem obiectul întreg părintelui
  };

  // Închide dropdown la click în afară
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        className="w-full bg-transparent px-2 py-1.5 text-slate-900 placeholder:text-slate-400 outline-none focus:placeholder-slate-300"
        placeholder={placeholder || "Caută produs..."}
        value={query}
        onChange={(e) => {
           setQuery(e.target.value);
           if (!isOpen && e.target.value.length > 1) setIsOpen(true);
        }}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
      />
      
      {/* Loading Indicator mic in dreapta */}
      {loading && (
        <div className="absolute right-2 top-2">
           <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-75 rounded-xl border border-slate-200 bg-white shadow-xl max-h-60 overflow-auto">
          {results.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelect(p)}
              className="cursor-pointer border-b border-slate-50 px-4 py-2 hover:bg-slate-50 last:border-0"
            >
              <div className="text-sm font-semibold text-slate-800">{p.name}</div>
              <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                <span>SKU: {p.sku || "-"}</span>
                <span>{Number(p.price).toFixed(2)} RON</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}