/**
 * Add products the first import skipped, and restore old products that are not in the export.
 *  1. Export products that are not in the DB (price 0 or otherwise skipped) are inserted as
 *     INACTIVE when their price is 0 (hidden on the storefront, visible in admin).
 *  2. Old products from the pre-import backup whose SKU is not in the DB are restored with
 *     their original id, codes, images, stock and wishlist rows.
 *
 * Usage (dry run by default):
 *   node --env-file=.env scripts/import-missing-products.mjs <export_dir> <backup_dir> <categories_backup_dir>
 *   ... --execute
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const [exportDir, backupDir, catBackupDir] = args.filter((a) => !a.startsWith("--"));
const EXECUTE = args.includes("--execute");
if (!catBackupDir) { console.error("Usage: node --env-file=.env scripts/import-missing-products.mjs <export_dir> <backup_dir> <categories_backup_dir> [--execute]"); process.exit(1); }

const BUCKET = "product-images";
const MAIN_WAREHOUSE_ID = "19995c62-08f7-425f-9e34-5ca5a268c733";
const CELL = /<Cell[^>]*>(?:<Data[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/Data>)?<\/Cell>/g;
const JUNK_TOP = new Set(["alte produse", "test", "asroot"]);
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const stripHtml = (h) => decode(h || "").replace(/<[^>]*>/g, "").replace(/\n\n+/g, "\n").replace(/ {2,}/g, " ").trim();
const slugify = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
const safe = (s) => s.replace(/[^A-Za-z0-9._-]/g, "_");
const readJson = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));

async function* readRows(file) {
  let hdr = null, buf = "";
  const rl = readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.includes("<Row>")) buf = "";
    buf += line + "\n";
    if (!line.includes("</Row>")) continue;
    const vals = [...buf.matchAll(CELL)].map((m) => (m[1] ?? m[2] ?? "").trim());
    if (!hdr) { if (vals.includes("ProductCode")) hdr = vals.map((h) => h.replace(/\s+-\s+P\d+$/, "")); continue; }
    const row = {};
    hdr.forEach((h, i) => { if (h && !row[h] && vals[i]) row[h] = vals[i]; });
    yield row;
  }
}
function primaryPath(cat) {
  let best = [];
  for (const raw of (cat || "").split("#")) {
    const segs = raw.split("/").map((s) => s.trim()).filter(Boolean).filter((s, i, a) => i === 0 || s !== a[i - 1]);
    if (segs.length > best.length) best = segs;
  }
  return JUNK_TOP.has((best[0] || "alte produse").toLowerCase()) ? ["Alte produse"] : best;
}
const splitImages = (v) => (v || "").split(/[#,;\s]+/).filter((p) => /^https?:\/\//.test(p));

// ---------- load ----------
const expDir = path.join(exportDir, "ExportProducts");
const newest = fs.readdirSync(expDir).filter((f) => f.endsWith(".xml")).map((f) => path.join(expDir, f))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const sql = postgres(process.env.DATABASE_URL.trim(), { ssl: "require", max: 2, prepare: false });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const haveSkus = new Set((await sql`select sku from product`).map((p) => p.sku));
const usedSlugs = new Set((await sql`select slug from product`).map((p) => p.slug));
const exportSkus = new Set();
const fromExport = [];
const invalid = [];
for await (const r of readRows(newest)) {
  if (!r.ProductCode) continue;
  exportSkus.add(r.ProductCode);
  if (haveSkus.has(r.ProductCode)) continue;
  if (!r.ProductName) { invalid.push(r.ProductCode); continue; }
  const price = parseFloat(r.Price11763 || "") || 0;
  const images = [...splitImages(r.Image), ...splitImages(r.AddImages)].map((u) => {
    const parts = new URL(u).pathname.split("/");
    const base = decodeURIComponent(parts.at(-1));
    const file = path.join(exportDir, parts.at(-2), base);
    return { dest: `import/${safe(r.ProductCode)}/${safe(base)}`, file: fs.existsSync(file) ? file : null };
  });
  fromExport.push({ r, price, images });
}
// dedupe by sku (last wins already via Set check; rows can repeat)
const seen = new Set();
const exportNew = fromExport.filter((x) => (seen.has(x.r.ProductCode) ? false : seen.add(x.r.ProductCode)));

// old products to restore
const oldProducts = readJson(backupDir, "product.json").filter((p) => !haveSkus.has(p.sku) && !exportSkus.has(p.sku));
const oldCats = readJson(catBackupDir, "category.json");
const oldCatName = (id) => { let c = oldCats.find((x) => x.id === id); while (c?.parent_id) c = oldCats.find((x) => x.id === c.parent_id); return c?.name ?? null; };
const brandIds = new Set((await sql`select id from brand`).map((b) => b.id));
const inBucket = new Set((await sql`select name from storage.objects where bucket_id=${BUCKET} and name like 'import/%'`).map((o) => o.name));
const uploads = new Map();
for (const x of exportNew) for (const i of x.images) if (i.file && !inBucket.has(i.dest)) uploads.set(i.dest, i);

console.log(`
== Plan ==
Export products not in DB: ${exportNew.length}  (price 0 -> inactive: ${exportNew.filter((x) => !(x.price > 0)).length}, with price -> active: ${exportNew.filter((x) => x.price > 0).length})
  skipped (no name): ${invalid.length}
  images to upload: ${uploads.size}
Old products to restore from backup: ${oldProducts.length}  ${oldProducts.slice(0, 5).map((p) => p.sku).join(", ")}
`);
if (!EXECUTE) { console.log("Dry run only. Re-run with --execute to apply."); await sql.end(); process.exit(0); }

// ---------- backup of what we touch is the existing backups; upload images ----------
const ctype = (f) => ({ png: "image/png", gif: "image/gif", webp: "image/webp" }[f.split(".").pop().toLowerCase()] || "image/jpeg");
const queue = [...uploads.values()];
let up = 0, fail = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const i = queue.pop();
    const { error } = await sb.storage.from(BUCKET).upload(i.dest, fs.readFileSync(i.file), { contentType: ctype(i.file), upsert: false });
    if (error && !/exists|Duplicate/i.test(error.message)) { fail++; i.failed = true; console.warn("upload failed", i.dest, error.message); } else up++;
  }
}));
console.log(`Uploaded ${up}, failed ${fail}`);

const taxRows = await sql`select id, rate from tax_rate`;
const defaultTax = taxRows.find((t) => Number(t.rate) === 0.21)?.id;
const taxFor = (v) => taxRows.find((t) => Math.abs(Number(t.rate) - v) < 1e-6)?.id ?? defaultTax;

await sql.begin(async (tx) => {
  const catCache = new Map(), brandCache = new Map();
  const category = async (segs) => {
    let parent = null;
    for (const name of segs) {
      const key = `${parent}|${name}`;
      if (catCache.has(key)) { parent = catCache.get(key); continue; }
      const found = parent
        ? await tx`select id from category where name = ${name} and parent_id = ${parent} limit 1`
        : await tx`select id from category where name = ${name} and parent_id is null limit 1`;
      let id = found[0]?.id;
      if (!id) {
        let slug = slugify(name) || "categorie", n = 1;
        const base = slug;
        while ((await tx`select 1 from category where slug = ${slug}`).length) slug = `${base}-${n++}`;
        id = (await tx`insert into category (name, slug, parent_id, created_at) values (${name}, ${slug}, ${parent}, now()) returning id`)[0].id;
      }
      catCache.set(key, id);
      parent = id;
    }
    return parent;
  };
  const brand = async (name) => {
    if (brandCache.has(name)) return brandCache.get(name);
    let id = (await tx`select id from brand where name = ${name} limit 1`)[0]?.id;
    if (!id) {
      let slug = slugify(name) || "brand", n = 1;
      const base = slug;
      while ((await tx`select 1 from brand where slug = ${slug}`).length) slug = `${base}-${n++}`;
      id = (await tx`insert into brand (name, slug, created_at) values (${name}, ${slug}, now()) returning id`)[0].id;
    }
    brandCache.set(name, id);
    return id;
  };

  // 1. export products
  for (let i = 0; i < exportNew.length; i += 500) {
    const batch = exportNew.slice(i, i + 500);
    const prodRows = [];
    for (const { r, price } of batch) {
      let slug = slugify(r.ProductName) || "produs";
      const base = slug; let n = 1;
      while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
      usedSlugs.add(slug);
      prodRows.push({
        sku: r.ProductCode, name: r.ProductName, slug,
        brand_id: r.BrandName ? await brand(r.BrandName) : null,
        category_id: await category(primaryPath(r.Category)),
        tax_rate_id: taxFor(parseFloat(r.VAT || "0.21")),
        buy_price_net: price / 1.2, profit_margin_pct: 20,
        is_active: price > 0 && r.Enabled === "1", description: stripHtml(r.Description),
        stock_on_hand: Math.max(0, parseInt(r.Stock || "0") || 0), stock_reserved: 0, uom: "buc",
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
      images.filter((x) => x.file && !x.failed && (uploads.get(x.dest)?.failed !== true)).forEach((x, idx) =>
        imgs.push({ product_id: pid, storage_path: x.dest, alt: r.ProductName, sort_order: idx, is_primary: idx === 0 }));
      inv.push({ product_id: pid, warehouse_id: MAIN_WAREHOUSE_ID, stock_on_hand: Math.max(0, parseInt(r.Stock || "0") || 0), stock_reserved: 0 });
    }
    await tx`insert into product_code ${tx(codes)} on conflict do nothing`;
    if (imgs.length) await tx`insert into product_image ${tx(imgs)}`;
    await tx`insert into inventory_balance ${tx(inv)}`;
  }
  console.log(`Inserted ${exportNew.length} export products`);

  // 2. restore old products with their original ids
  if (oldProducts.length) {
    const ids = new Set(oldProducts.map((p) => p.id));
    const rows = [];
    for (const p of oldProducts) {
      let slug = p.slug; const base = slug; let n = 1;
      while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
      usedSlugs.add(slug);
      const top = oldCatName(p.category_id);
      rows.push({ ...p, slug, brand_id: brandIds.has(p.brand_id) ? p.brand_id : null, category_id: top ? await category([top]) : null });
    }
    await tx`insert into product ${tx(rows)}`;
    const pick = (file) => readJson(backupDir, file).filter((x) => ids.has(x.product_id));
    const codes = pick("product_code.json"), imgs = pick("product_image.json"), inv = pick("inventory_balance.json"), wl = pick("customer_wishlist.json");
    if (codes.length) await tx`insert into product_code ${tx(codes)} on conflict do nothing`;
    if (imgs.length) await tx`insert into product_image ${tx(imgs)}`;
    if (inv.length) await tx`insert into inventory_balance ${tx(inv)} on conflict do nothing`;
    if (wl.length) await tx`insert into customer_wishlist ${tx(wl)} on conflict do nothing`;
    console.log(`Restored ${oldProducts.length} old products (codes ${codes.length}, images ${imgs.length}, stock rows ${inv.length}, wishlist ${wl.length})`);
  }
});
console.log("Done. Transaction committed.");
await sql.end();
