"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const CONSENT_KEY = "shoptruck_cookie_consent";
const GAME_KEY = "shoptruck_welcome_game";
const DELAY_MS = 30_000;
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const SIZE = 3;
const BOARD_PX = 288;
const HIDDEN_PREFIXES = ["/admin", "/checkout", "/cos", "/login", "/signup", "/api"];

// Truck scene, split into SIZE x SIZE pieces with CSS background-position.
const SCENE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'>
<rect width='300' height='300' fill='#bfdbfe'/>
<circle cx='245' cy='55' r='28' fill='#feab1f'/>
<rect y='215' width='300' height='85' fill='#475569'/>
<rect y='252' width='300' height='6' fill='#e2e8f0'/>
<rect x='20' y='105' width='150' height='95' rx='6' fill='#1e293b'/>
<rect x='20' y='105' width='150' height='14' fill='#feab1f'/>
<rect x='172' y='135' width='95' height='65' rx='8' fill='#feab1f'/>
<rect x='215' y='145' width='42' height='30' rx='4' fill='#e0f2fe'/>
<rect x='20' y='198' width='247' height='10' fill='#0f172a'/>
<circle cx='70' cy='212' r='22' fill='#0f172a'/><circle cx='70' cy='212' r='9' fill='#94a3b8'/>
<circle cx='135' cy='212' r='22' fill='#0f172a'/><circle cx='135' cy='212' r='9' fill='#94a3b8'/>
<circle cx='235' cy='212' r='22' fill='#0f172a'/><circle cx='235' cy='212' r='9' fill='#94a3b8'/>
<text x='95' y='170' font-family='Arial' font-weight='bold' font-size='20' fill='#feab1f' text-anchor='middle'>SHOPTRUCK</text>
</svg>`;
const SCENE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(SCENE_SVG)}")`;

// Set once per full page load, so client-side navigation doesn't restart the 30s.
const arrivedAt = typeof window !== "undefined" ? Date.now() : 0;

function shuffled(): number[] {
  const solved = Array.from({ length: SIZE * SIZE }, (_, i) => i);
  let arr = solved;
  while (arr.every((v, i) => v === i)) {
    arr = [...solved];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  return arr;
}

function readState(): string | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    if (raw === "done") return "done";
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < SNOOZE_MS ? "snoozed" : null;
  } catch {
    return "done"; // can't persist -> don't nag
  }
}

export function WelcomeGame() {
  const pathname = usePathname() || "/";
  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  const [open, setOpen] = useState(false);
  const [pieces, setPieces] = useState<number[]>(() => shuffled());
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [emailed, setEmailed] = useState(true);

  const solved = useMemo(() => pieces.every((v, i) => v === i), [pieces]);

  // Show once, 30s after the visitor arrived, and only with cookie consent.
  useEffect(() => {
    if (hidden || open || readState()) return;
    const start = arrivedAt || Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - start < DELAY_MS) return;
      let consent: string | null = null;
      try {
        consent = localStorage.getItem(CONSENT_KEY);
      } catch {}
      if (consent === "accepted" && !readState()) {
        setOpen(true);
        window.clearInterval(id);
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [hidden, open]);

  const close = () => {
    try {
      if (!code) localStorage.setItem(GAME_KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  };

  const tap = (idx: number) => {
    if (solved) return;
    if (selected === null) return setSelected(idx);
    if (selected === idx) return setSelected(null);
    setPieces((p) => {
      const next = [...p];
      [next[selected], next[idx]] = [next[idx], next[selected]];
      return next;
    });
    setMoves((m) => m + 1);
    setSelected(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public/welcome-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, marketing_consent: marketing }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "A apărut o eroare.");
        return;
      }
      setCode(data.code);
      setEmailed(!!data.emailed);
      try {
        localStorage.setItem(GAME_KEY, "done");
      } catch {}
    } catch {
      setError("A apărut o eroare. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  };

  if (!open || hidden) return null;

  const cell = BOARD_PX / SIZE;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <button
          onClick={close}
          aria-label="Închide"
          className="absolute right-3 top-3 rounded-full px-2 text-xl leading-none text-slate-700 hover:bg-slate-100"
        >
          ×
        </button>

        {code ? (
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900">Ai câștigat 5% reducere! 🎉</h2>
            <p className="mt-2 text-sm text-slate-800">
              {emailed ? "Ți-am trimis codul și pe email." : "Salvează codul de mai jos."} Aplică-l la finalizarea comenzii.
            </p>
            <div className="mt-4 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-2xl font-bold tracking-widest text-slate-900 select-all">
              {code}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-full bg-amber-400 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300"
            >
              Mai departe
            </button>
          </div>
        ) : (
          <>
            <h2 className="pr-6 text-lg font-bold text-slate-900">Joacă și câștigă 5% reducere</h2>
            <p className="mt-1 text-sm text-slate-800">
              {solved
                ? "Bravo! Introdu emailul pentru a primi codul."
                : "Atinge două piese pentru a le schimba între ele și reface camionul."}
            </p>

            <div
              className="mx-auto mt-4 grid overflow-hidden rounded-lg border border-slate-300"
              style={{
                width: BOARD_PX,
                height: BOARD_PX,
                gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
              }}
            >
              {pieces.map((piece, idx) => {
                const px = (piece % SIZE) * cell;
                const py = Math.floor(piece / SIZE) * cell;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => tap(idx)}
                    aria-label={`Piesa ${idx + 1}`}
                    className={`transition ${
                      selected === idx ? "outline outline-4 -outline-offset-4 outline-amber-400 brightness-90" : ""
                    } ${solved ? "" : "border border-white/40"}`}
                    style={{
                      backgroundImage: SCENE_URL,
                      backgroundSize: `${BOARD_PX}px ${BOARD_PX}px`,
                      backgroundPosition: `-${px}px -${py}px`,
                    }}
                  />
                );
              })}
            </div>

            {!solved && <p className="mt-2 text-center text-xs text-slate-700">Mutări: {moves}</p>}

            {solved && (
              <form onSubmit={submit} className="mt-4 space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Adresa ta de email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600"
                />
                <label className="flex items-start gap-2 text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="mt-0.5"
                  />
                  Doresc să primesc oferte și noutăți pe email (opțional).
                </label>
                {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                <button
                  disabled={busy}
                  className="w-full rounded-full bg-amber-400 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
                >
                  {busy ? "Se trimite..." : "Primesc codul"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
