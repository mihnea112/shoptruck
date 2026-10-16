/**
 * Replace the product catalog with the old-site export.
 *
 * Usage (dry run is the default and writes nothing):
 *   node --env-file=.env scripts/replace-catalog.mjs <export_dir> [--union] [--limit N]
 *   node --env-file=.env scripts/replace-catalog.mjs <export_dir> --execute
 *
 * Steps with --execute:
 *   1. back up product-related tables to backups/<timestamp>/*.json
 *   2. upload images missing from the product-images bucket to import/<ProductCode>/<file>
 *   3. in ONE transaction: delete products that nothing else depends on, keep (and
 *      deactivate if absent from the export) products referenced by orders / invoices /
 *      receipts / stock documents, then insert the export's products
 *
 * Source: newest ExportProducts file; --union merges every file (newest wins).
 * Re-running is safe: images already in the bucket are skipped.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "product-images";
const MAIN_WAREHOUSE_ID = "19995c62-08f7-425f-9e34-5ca5a268c733";
const CELL = /<Cell[^>]*>(?:<Data[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/Data>)?<\/Cell>/g;
// tables whose rows must survive (history); products referenced here are never deleted
const PROTECTED_REFS = [
  "order_item", "invoice_item", "goods_receipt_item", "stock_doc_item",
  "stock_move", "stock_reservation", "stock_transfer",
];

const args = process.argv.slice(2);
const exportDir = args.find((a) => !a.startsWith("--"));
const EXECUTE = args.includes("--execute");
const UNION = args.includes("--union");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
if (!exportDir) {
  console.error("Usage: node --env-file=.env scripts/replace-catalog.mjs <export_dir> [--execute] [--union] [--limit N]");
  process.exit(1);
}

const decode = (s) =>
  s.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const stripHtml = (h) =>
  decode(h || "").replace(/<[^>]*>/g, "").replace(/\n\n+/g, "\n").replace(/ {2,}/g, " ").trim();
const slugify = (t) =>
  t.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
const safe = (s) => s.replace(/[^A-Za-z0-9._-]/g, "_");

async function* readRows(file) {
  let hdr = null;
  let buf = "";
  const rl = readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.includes("<Row>")) buf = "";
    buf += line + "\n";
    if (!line.includes("</Row>")) continue;
    const vals = [...buf.matchAll(CELL)].map((m) => (m[1] ?? m[2] ?? "").trim());
    if (!hdr) {
      if (vals.includes("ProductCode")) hdr = vals.map((h) => h.replace(/\s+-\s+P\d+$/, ""));
      continue;
    }
    const row = {};
    hdr.forEach((h, i) => { if (h && !row[h] && vals[i]) row[h] = vals[i]; });
    yield row;
  }
}

function splitImages(v) {
  return (v || "").split(/[#,;\s]+/).filter((p) => /^https?:\/\//.test(p));
}

function localImage(url) {
  const parts = new URL(url).pathname.split("/");
  const base = parts.at(-1);
  const folder = parts.at(-2);
  const file = path.join(exportDir, folder, decodeURIComponent(base));
  return { base, file: fs.existsSync(file) ? file : null };
}

// ---------- 1. load export ----------
const expDir = path.join(exportDir, "ExportProducts");
let files = fs.readdirSync(expDir).filter((f) => f.endsWith(".xml"))
  .map((f) => path.join(expDir, f))
  .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
if (!UNION) files = files.slice(-1);

const bySku = new Map();
for (const f of files) {
  for await (const r of readRows(f)) if (r.ProductCode) bySku.set(r.ProductCode, r);
}
let products = [...bySku.values()];
if (Number.isFinite(LIMIT)) products = products.slice(0, LIMIT);
console.log(`Source: ${files.length} file(s) -> ${products.length} unique products`);

const bad = [];
const rows = [];
for (const r of products) {
  const price = parseFloat(r.Price11763 || "");
  if (!r.ProductName || !(price > 0)) { bad.push(r.ProductCode); continue; }
  const imgs = [...splitImages(r.Image), ...splitImages(r.AddImages)];
  const seen = new Set();
  const images = [];
  for (const u of imgs) {
    const { base, file } = localImage(u);
    const dest = `import/${safe(r.ProductCode)}/${safe(base)}`;
    if (seen.has(dest)) continue;
    seen.add(dest);
    images.push({ dest, file, base });
  }
  rows.push({ r, price, images });
}
console.log(`Valid: ${rows.length}  skipped (no name / bad price): ${bad.length}`);

// ---------- 2. database + bucket state ----------
const sql = postgres(process.env.DATABASE_URL.trim(), { ssl: "require", max: 3, prepare: false });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const existing = await sql`select id, sku, slug from product`;
const protectedIds = new Set();
for (const t of PROTECTED_REFS) {
  for (const x of await sql.unsafe(`select distinct product_id from ${t} where product_id is not null`)) {
    protectedIds.add(x.product_id);
  }
}
const exportSkus = new Set(rows.map((x) => x.r.ProductCode));
const toDelete = existing.filter((p) => !protectedIds.has(p.id));
const kept = existing.filter((p) => protectedIds.has(p.id));
const keptSkus = new Set(kept.map((p) => p.sku));
const keptToDeactivate = kept.filter((p) => !exportSkus.has(p.sku));
const toInsert = rows.filter((x) => !keptSkus.has(x.r.ProductCode));

const inBucket = new Set(
  (await sql`select name from storage.objects where bucket_id = ${BUCKET} and name like 'import/%'`).map((o) => o.name),
);
const allImages = new Map(); // dest -> {file}
for (const x of toInsert) for (const i of x.images) allImages.set(i.dest, i);
const unresolved = [...allImages.values()].filter((i) => !i.file);
const toUpload = [...allImages.values()].filter((i) => i.file && !inBucket.has(i.dest));

console.log(`
== Plan ==
Existing products: ${existing.length}
  delete:                        ${toDelete.length}
  keep (referenced by history):  ${kept.length}   (deactivate if not in export: ${keptToDeactivate.length})
Insert from export:              ${toInsert.length}
Images referenced:               ${allImages.size}
  already in bucket (skip):      ${[...allImages.keys()].filter((d) => inBucket.has(d)).length}
  to upload:                     ${toUpload.length}
  file missing locally:          ${unresolved.length}  ${unresolved.slice(0, 3).map((i) => i.base).join(", ")}
`);

if (!EXECUTE) {
  console.log("Dry run only. Re-run with --execute to apply.");
  await sql.end();
  process.exit(0);
}

// ---------- 3. backup ----------
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const bdir = path.join("backups", stamp);
fs.mkdirSync(bdir, { recursive: true });
for (const t of ["product", "product_code", "product_image", "inventory_balance", "customer_wishlist", "customer_cart", "offer_item"]) {
  fs.writeFileSync(path.join(bdir, `${t}.json`), JSON.stringify(await sql.unsafe(`select * from ${t}`)));
}
console.log(`Backup written to ${bdir}`);

// ---------- 4. upload images ----------
const ctype = (f) => ({ png: "image/png", gif: "image/gif", webp: "image/webp" }[f.split(".").pop().toLowerCase()] || "image/jpeg");
let up = 0, upFail = 0;
const queue = [...toUpload];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const i = queue.pop();
    const { error } = await sb.storage.from(BUCKET).upload(i.dest, fs.readFileSync(i.file), {
      contentType: ctype(i.file), upsert: false,
    });
    if (error && !/exists|Duplicate/i.test(error.message)) { upFail++; i.failed = true; console.warn("upload failed", i.dest, error.message); }
    else up++;
    if ((up + upFail) % 500 === 0) console.log(`  uploaded ${up}/${toUpload.length}`);
  }
}));
console.log(`Uploaded ${up}, failed ${upFail}`);
const failed = new Set(toUpload.filter((i) => i.failed).map((i) => i.dest));

// ---------- 5. delete + insert in one transaction ----------
const taxRows = await sql`select id, rate from tax_rate`;
const defaultTax = taxRows.find((t) => Number(t.rate) === 0.21)?.id;
const taxFor = (v) => taxRows.find((t) => Math.abs(Number(t.rate) - v) < 1e-6)?.id ?? defaultTax;

await sql.begin(async (tx) => {
  const delIds = toDelete.map((p) => p.id);
  for (let i = 0; i < delIds.length; i += 2000) {
    const chunk = delIds.slice(i, i + 2000);
    await tx`delete from inventory_balance where product_id in ${tx(chunk)}`;
    await tx`delete from product where id in ${tx(chunk)}`;
  }
  if (keptToDeactivate.length) {
    await tx`update product set is_active = false where id in ${tx(keptToDeactivate.map((p) => p.id))}`;
  }

  const usedSlugs = new Set(kept.map((p) => p.slug));
  const catCache = new Map();
  const brandCache = new Map();

  const category = async (pathStr) => {
    if (catCache.has(pathStr)) return catCache.get(pathStr);
    let parent = null;
    for (const name of pathStr.split("#").map((s) => s.trim()).filter(Boolean)) {
      const key = `${parent}|${name}`;
      if (catCache.has(key)) { parent = catCache.get(key); continue; }
      const found = parent
        ? await tx`select id from category where name = ${name} and parent_id = ${parent} limit 1`
        : await tx`select id from category where name = ${name} and parent_id is null limit 1`;
      let id = found[0]?.id;
      if (!id) {
        let slug = slugify(name) || "categorie", n = 1;
        while ((await tx`select 1 from category where slug = ${slug}`).length) slug = `${slugify(name)}-${n++}`;
        id = (await tx`insert into category (name, slug, parent_id, created_at) values (${name}, ${slug}, ${parent}, now()) returning id`)[0].id;
      }
      catCache.set(key, id);
      parent = id;
    }
    catCache.set(pathStr, parent);
    return parent;
  };
  const brand = async (name) => {
    if (brandCache.has(name)) return brandCache.get(name);
    let id = (await tx`select id from brand where name = ${name} limit 1`)[0]?.id;
    if (!id) {
      let slug = slugify(name) || "brand", n = 1;
      while ((await tx`select 1 from brand where slug = ${slug}`).length) slug = `${slugify(name)}-${n++}`;
      id = (await tx`insert into brand (name, slug, created_at) values (${name}, ${slug}, now()) returning id`)[0].id;
    }
    brandCache.set(name, id);
    return id;
  };

  let done = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500);
    const prodRows = [];
    for (const { r, price } of batch) {
      let slug = slugify(r.ProductName) || "produs", base = slug, n = 1;
      while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
      usedSlugs.add(slug);
      const stock = Math.max(1, parseInt(r.Stock || "1") || 1); // same rule as the app importer
      prodRows.push({
        sku: r.ProductCode, name: r.ProductName, slug,
        brand_id: r.BrandName ? await brand(r.BrandName) : null,
        category_id: r.Category ? await category(r.Category) : null,
        tax_rate_id: taxFor(parseFloat(r.VAT || "0.21")),
        buy_price_net: price / 1.2, profit_margin_pct: 20,
        is_active: r.Enabled === "1", description: stripHtml(r.Description),
        stock_on_hand: stock, stock_reserved: 0, uom: "buc",
      });
    }
    const ins = await tx`insert into product ${tx(prodRows)} returning id, sku`;
    const idBySku = new Map(ins.map((p) => [p.sku, p.id]));

    const codes = [], imgs = [], inv = [];
    for (const { r, images } of batch) {
      const pid = idBySku.get(r.ProductCode);
      codes.push({ product_id: pid, code_id: r.ProductCode, is_primary: true, code_kind: "SKU" });
      for (const c of (r.EAN || "").split("#").map((s) => s.trim()).filter(Boolean)) codes.push({ product_id: pid, code_id: c, is_primary: false, code_kind: "EAN" });
      for (const c of (r.ComplementaryProductsCodes || "").split("#").map((s) => s.trim()).filter((s) => s && s !== r.ProductCode)) codes.push({ product_id: pid, code_id: c, is_primary: false, code_kind: "EQUIVALENT" });
      images.filter((x) => x.file && !failed.has(x.dest)).forEach((x, idx) =>
        imgs.push({ product_id: pid, storage_path: x.dest, alt: r.ProductName, sort_order: idx, is_primary: idx === 0 }));
      inv.push({ product_id: pid, warehouse_id: MAIN_WAREHOUSE_ID, stock_on_hand: Math.max(1, parseInt(r.Stock || "1") || 1), stock_reserved: 0 });
    }
    await tx`insert into product_code ${tx(codes)} on conflict do nothing`;
    if (imgs.length) await tx`insert into product_image ${tx(imgs)}`;
    await tx`insert into inventory_balance ${tx(inv)}`;
    done += batch.length;
    console.log(`  inserted ${done}/${toInsert.length}`);
  }
});

console.log("Done. Transaction committed.");
await sql.end();
