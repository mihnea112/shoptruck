"use client";

import { useState, useEffect, useRef } from "react";

// Definim tipul DTO (Data Transfer Object) folosit in comunicarea cu API
export type CustomerDTO = {
  id?: string;
  kind: "company" | "individual";
  display_name?: string;

  // Date firma
  company_name?: string;
  vat_id?: string;
  reg_no?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;

  // Date persoana
  first_name?: string;
  last_name?: string;
  phone?: string;
};

interface CustomerSearchProps {
  onSelect: (customer: CustomerDTO) => void;
}

export default function CustomerSearch({ onSelect }: CustomerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);

  // State pentru formularul de creare noua
  const [newCust, setNewCust] = useState<CustomerDTO>({
    kind: "individual",
    first_name: "",
    last_name: "",
    phone: "",
    company_name: "",
    vat_id: "",
  });

  const wrapperRef = useRef<HTMLDivElement>(null);

  // 1. Logica de Cautare (Debounce)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.ok) setResults(data.items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setShowDropdown(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // 2. Selectarea unui client existent
  function handleSelect(c: CustomerDTO) {
    setSelectedCustomer(c);
    setQuery(c.display_name || "");
    setShowDropdown(false);
    onSelect(c);
  }

  // 3. Salvare Client Nou (API)
  async function saveNewCustomer() {
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCust),
      });
      const data = await res.json();

      if (data.ok) {
        // Construim obiectul complet pentru a-l selecta imediat
        const created: CustomerDTO = {
          ...newCust,
          id: data.customerId,
          display_name:
            newCust.kind === "company"
              ? newCust.company_name
              : `${newCust.first_name} ${newCust.last_name}`,
        };
        handleSelect(created);
        setShowCreateModal(false);
      } else {
        alert("Eroare: " + data.error);
      }
    } catch (e) {
      alert("Eroare la salvare.");
    }
  }

  // Închide dropdown dacă dai click afară
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">Caută Client</label>
      
      {/* Input Search */}
      <div className="relative">
        <input
          type="text"
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="Nume, CUI, Telefon..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedCustomer(null); // Reset daca modifici textul
          }}
          onFocus={() => { if(results.length > 0) setShowDropdown(true); }}
        />
        {loading && (
          <div className="absolute right-3 top-2.5 text-xs text-slate-400">Loading...</div>
        )}
      </div>

      {/* Dropdown Rezultate */}
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.length > 0 ? (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
              >
                <div className="font-semibold text-slate-800">{r.display_name}</div>
                <div className="text-xs text-slate-500">
                   {r.kind === 'company' ? `CUI: ${r.vat_id}` : `Tel: ${r.phone || '-'}`}
                </div>
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-sm text-slate-500">
              Nu am găsit rezultate.
            </div>
          )}
          
          {/* Buton Create New */}
          <button
            onClick={() => { setShowDropdown(false); setShowCreateModal(true); }}
            className="block w-full bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100 rounded-b-lg"
          >
            + Creează Client Nou
          </button>
        </div>
      )}

      {selectedCustomer && (
        <div className="mt-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800 border border-green-200">
          Client selectat: <strong>{selectedCustomer.display_name}</strong>
        </div>
      )}

      {/* MODAL CREARE CLIENT NOU */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Client Nou</h3>
            
            {/* Tabs */}
            <div className="flex gap-4 mb-4 border-b border-slate-200 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="kind" 
                  checked={newCust.kind === 'individual'} 
                  onChange={() => setNewCust({...newCust, kind: 'individual'})}
                />
                <span className="text-sm font-medium">Persoană Fizică</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="kind" 
                  checked={newCust.kind === 'company'} 
                  onChange={() => setNewCust({...newCust, kind: 'company'})}
                />
                <span className="text-sm font-medium">Companie</span>
              </label>
            </div>

            <div className="space-y-3">
              {newCust.kind === 'individual' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      placeholder="Prenume" 
                      className="border rounded p-2 text-sm w-full"
                      value={newCust.first_name}
                      onChange={e => setNewCust({...newCust, first_name: e.target.value})}
                    />
                    <input 
                      placeholder="Nume Familie" 
                      className="border rounded p-2 text-sm w-full"
                      value={newCust.last_name}
                      onChange={e => setNewCust({...newCust, last_name: e.target.value})}
                    />
                  </div>
                  <input 
                    placeholder="Telefon" 
                    className="border rounded p-2 text-sm w-full"
                    value={newCust.phone}
                    onChange={e => setNewCust({...newCust, phone: e.target.value})}
                  />
                </>
              ) : (
                <>
                  <input 
                    placeholder="Nume Firmă (ex: SC TEST SRL)" 
                    className="border rounded p-2 text-sm w-full"
                    value={newCust.company_name}
                    onChange={e => setNewCust({...newCust, company_name: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      placeholder="CUI (ex: RO123456)" 
                      className="border rounded p-2 text-sm w-full"
                      value={newCust.vat_id}
                      onChange={e => setNewCust({...newCust, vat_id: e.target.value})}
                    />
                     <input 
                      placeholder="Nr. Reg. Com (J40/...)" 
                      className="border rounded p-2 text-sm w-full"
                      value={newCust.reg_no}
                      onChange={e => setNewCust({...newCust, reg_no: e.target.value})}
                    />
                  </div>
                  <input 
                      placeholder="Persoană Contact / Delegat" 
                      className="border rounded p-2 text-sm w-full"
                      value={newCust.contact_name}
                      onChange={e => setNewCust({...newCust, contact_name: e.target.value})}
                    />
                    <input 
                      placeholder="Telefon Firmă" 
                      className="border rounded p-2 text-sm w-full"
                      value={newCust.contact_phone}
                      onChange={e => setNewCust({...newCust, contact_phone: e.target.value})}
                    />
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Anulează
              </button>
              <button 
                onClick={saveNewCustomer}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Salvează și Selectează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}