/**
 * Rebuild the category tree from the export and infer categories for products that
 * the export left in "Alte produse" (or in junk categories test / ASroot / none).
 *
 * Export format: "A#A/B#A/B/C" = several categories separated by '#', hierarchy by '/'.
 * (The first import chained the '#' parts as nested levels; this fixes that.)
 *
 * Usage (dry run by default, writes nothing):
 *   node --env-file=.env scripts/fix-categories.mjs <export_dir>
 *   node --env-file=.env scripts/fix-categories.mjs <export_dir> --execute
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import postgres from "postgres";

const args = process.argv.slice(2);
const exportDir = args.find((a) => !a.startsWith("--"));
const EXECUTE = args.includes("--execute");
if (!exportDir) { console.error("Usage: node --env-file=.env scripts/fix-categories.mjs <export_dir> [--execute]"); process.exit(1); }

const CELL = /<Cell[^>]*>(?:<Data[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/Data>)?<\/Cell>/g;
const JUNK_TOP = new Set(["alte produse", "test", "asroot"]);
const STOP = new Set(["pentru", "set", "kit", "cu", "sau", "din", "dreapta", "stanga", "fata", "spate", "bucata", "buc", "nou", "noua"]);
const slugify = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
  .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

async function* readRows(file) {
  let hdr = null, buf = "";
  const rl = readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.includes("<Row>")) buf = "";
    buf += line + "\n";
    if (!line.includes("</Row>")) continue;
    const vals = [...buf.matchAll(CELL)].map((m) => (m[1] ?? m[2] ?? "").trim());
    if (!hdr) { if (vals.includes("ProductCode")) hdr = vals; continue; }
    const row = {};
    hdr.forEach((h, i) => { if (h && !row[h] && vals[i]) row[h] = vals[i]; });
    yield row;
  }
}

// primary category = the deepest path among the '#'-separated ones; consecutive duplicate
// segments ("COMPONENTE MOTOR/COMPONENTE MOTOR") are collapsed
function primaryPath(cat) {
  let best = [];
  for (const raw of (cat || "").split("#")) {
    const segs = raw.split("/").map((s) => s.trim()).filter(Boolean).filter((s, i, a) => i === 0 || s !== a[i - 1]);
    if (segs.length > best.length) best = segs;
  }
  return best;
}
const isJunk = (p) => p.length === 0 || JUNK_TOP.has(p[0].toLowerCase());

const tokens = (name) =>
  (name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z]{3,}/g)?.filter((t) => !STOP.has(t)) ?? [];
const keys = (name) => {
  const t = tokens(name);
  return [t.slice(0, 3).join(" "), t.slice(0, 2).join(" "), t[0] ?? ""].filter(Boolean);
};

// ---------- load ----------
const expDir = path.join(exportDir, "ExportProducts");
const newest = fs.readdirSync(expDir).filter((f) => f.endsWith(".xml"))
  .map((f) => path.join(expDir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const catBySku = new Map();
for await (const r of readRows(newest)) if (r.ProductCode) catBySku.set(r.ProductCode, r.Category || "");

const sql = postgres(process.env.DATABASE_URL.trim(), { ssl: "require", max: 2, prepare: false });
const products = await sql`select id, sku, name from product`;

const train = [], pool = [];
for (const p of products) {
  const path_ = primaryPath(catBySku.get(p.sku));
  (isJunk(path_) ? pool : train).push({ ...p, path: path_ });
}

// ---------- inference model ----------
const model = new Map(); // key -> Map(pathString -> count)
const bump = (k, ps) => { let m = model.get(k); if (!m) model.set(k, (m = new Map())); m.set(ps, (m.get(ps) || 0) + 1); };
function fit(rows) {
  model.clear();
  for (const p of rows) { const ps = p.path.join("/"); for (const k of keys(p.name)) bump(k, ps); }
}
function predict(name) {
  for (const [i, k] of keys(name).entries()) {
    const m = model.get(k); if (!m) continue;
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const minSupport = i === 0 ? 3 : i === 1 ? 4 : 10;
    const minShare = i === 2 ? 0.9 : 0.85;
    if (total < minSupport) continue;
    const [best, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / total >= minShare) return best.split("/");
    // fall back to the top-level category when leaves disagree but the top-level agrees
    const tops = new Map();
    for (const [ps, c] of m) tops.set(ps.split("/")[0], (tops.get(ps.split("/")[0]) || 0) + c);
    const [t, tn] = [...tops.entries()].sort((a, b) => b[1] - a[1])[0];
    if (tn / total >= 0.9) return [t];
  }
  return null;
}

// holdout accuracy on the categorized products (every 10th as test)
const test = train.filter((_, i) => i % 10 === 0), fitSet = train.filter((_, i) => i % 10 !== 0);
fit(fitSet);
let answered = 0, correctTop = 0, correctExact = 0;
for (const p of test) {
  const g = predict(p.name); if (!g) continue;
  answered++;
  if (g[0] === p.path[0]) correctTop++;
  if (g.join("/") === p.path.join("/") || p.path.join("/").startsWith(g.join("/") + "/")) correctExact++;
}
fit(train);

const assigned = new Map(); // product id -> path
const perCat = new Map();
for (const p of pool) {
  const g = predict(p.name);
  if (!g) continue;
  assigned.set(p.id, g);
  const k = g.join("/");
  perCat.set(k, (perCat.get(k) || 0) + 1);
}

// ---------- category tree ----------
const final = new Map(); // product id -> path
for (const p of train) final.set(p.id, p.path);
for (const [id, g] of assigned) final.set(id, g);
const altePath = ["Alte produse"];
for (const p of pool) if (!final.has(p.id)) final.set(p.id, altePath);

const nodes = new Set(); // all path prefixes, joined by '/'
for (const ps of final.values()) for (let i = 1; i <= ps.length; i++) nodes.add(ps.slice(0, i).join("\u0001"));

const oldCats = await sql`select id, name, parent_id from category`;
const refs = await sql`select conrelid::regclass::text tbl, a.attname col from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.contype = 'f' and c.confrelid = 'public.category'::regclass and c.conrelid <> 'public.category'::regclass`;

console.log(`
== Dry run ==
Products: ${products.length}   with a real category: ${train.length}   to infer (Alte produse/test/ASroot/none): ${pool.length}
Holdout check on known products: answered ${answered}/${test.length}, top-level correct ${(100 * correctTop / answered).toFixed(1)}%, exact/ancestor correct ${(100 * correctExact / answered).toFixed(1)}%
Inferred: ${assigned.size}   stay in "Alte produse": ${pool.length - assigned.size}
New category tree: ${nodes.size} categories (currently ${oldCats.length}, garbled)
Other tables referencing category: ${refs.map((r) => `${r.tbl}.${r.col}`).join(", ") || "none"}

Top inferred categories:`);
for (const [k, n] of [...perCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(n).padStart(6)}  ${k}`);

if (!EXECUTE) { console.log("\nDry run only. Re-run with --execute to apply."); await sql.end(); process.exit(0); }

// ---------- apply ----------
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const bdir = path.join("backups", `categories-${stamp}`);
fs.mkdirSync(bdir, { recursive: true });
fs.writeFileSync(path.join(bdir, "category.json"), JSON.stringify(oldCats));
fs.writeFileSync(path.join(bdir, "product_category.json"), JSON.stringify(await sql`select id, category_id from product`));
console.log(`Backup written to ${bdir}`);

await sql.begin(async (tx) => {
  const usedSlugs = new Set((await tx`select slug from category`).map((c) => c.slug));
  const idByNode = new Map();
  // reuse a category only when name AND parent match exactly (top-level ones survive)
  const existing = await tx`select id, name, parent_id, slug from category`;
  const sorted = [...nodes].sort((a, b) => a.split("\u0001").length - b.split("\u0001").length);
  for (const node of sorted) {
    const segs = node.split("\u0001");
    const name = segs.at(-1);
    const parentId = segs.length > 1 ? idByNode.get(segs.slice(0, -1).join("\u0001")) : null;
    const hit = existing.find((c) => c.name === name && (c.parent_id ?? null) === (parentId ?? null));
    if (hit) { idByNode.set(node, hit.id); continue; }
    let slug = slugify(name) || "categorie", n = 1;
    const base = segs.length > 1 ? `${slugify(segs[0])}-${slug}` : slug;
    slug = usedSlugs.has(slug) ? base : slug;
    while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
    usedSlugs.add(slug);
    const [row] = await tx`insert into category (name, slug, parent_id, created_at) values (${name}, ${slug}, ${parentId}, now()) returning id`;
    idByNode.set(node, row.id);
  }
  // reassign products in bulk
  const byCat = new Map();
  for (const [pid, ps] of final) {
    const cid = idByNode.get(ps.join("\u0001"));
    if (!byCat.has(cid)) byCat.set(cid, []);
    byCat.get(cid).push(pid);
  }
  for (const [cid, ids] of byCat) {
    for (let i = 0; i < ids.length; i += 2000) await tx`update product set category_id = ${cid} where id in ${tx(ids.slice(i, i + 2000))}`;
  }
  // delete old categories that are no longer used (children first, only if unreferenced)
  const keep = new Set(idByNode.values());
  let removed = 0, progress = true;
  while (progress) {
    progress = false;
    for (const c of await tx`select id from category`) {
      if (keep.has(c.id)) continue;
      const used = await tx`select 1 from product where category_id = ${c.id} limit 1`;
      const child = await tx`select 1 from category where parent_id = ${c.id} limit 1`;
      if (used.length || child.length) continue;
      let blocked = false;
      for (const r of refs) if ((await tx.unsafe(`select 1 from ${r.tbl} where ${r.col} = $1 limit 1`, [c.id])).length) blocked = true;
      if (blocked) continue;
      await tx`delete from category where id = ${c.id}`;
      removed++; progress = true;
    }
  }
  console.log(`Categories: ${idByNode.size} in tree, ${removed} old removed`);
});
console.log("Done. Transaction committed.");
await sql.end();
