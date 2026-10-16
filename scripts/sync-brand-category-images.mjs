/**
 * Add brand.logo_path / category.image_path, upload the logo and category images from the
 * export to the product-images bucket (brands/<file>, categories/<file>) and link them.
 * Mappings come from the old site: scripts/data/brand-logos.txt, category-images.txt.
 * Skips files already in the bucket. Re-running is safe.
 *
 * Usage: node --env-file=.env scripts/sync-brand-category-images.mjs <export_dir> [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const exportDir = process.argv[2];
const DRY = process.argv.includes("--dry");
const BUCKET = "product-images";
if (!exportDir) { console.error("Usage: node --env-file=.env scripts/sync-brand-category-images.mjs <export_dir> [--dry]"); process.exit(1); }

const here = path.dirname(new URL(import.meta.url).pathname);
const lines = (f) => fs.readFileSync(path.join(here, "data", f), "utf8").split("\n").filter(Boolean).map((l) => l.split("|"));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

const sql = postgres(process.env.DATABASE_URL.trim(), { ssl: "require", max: 2, prepare: false });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!DRY) await sql`ALTER TABLE brand ADD COLUMN IF NOT EXISTS logo_path text`.then(() => sql`ALTER TABLE category ADD COLUMN IF NOT EXISTS image_path text`);
const hasCols = (await sql`select count(*)::int n from information_schema.columns where table_schema='public' and ((table_name='brand' and column_name='logo_path') or (table_name='category' and column_name='image_path'))`)[0].n === 2;

// ---- brands ----
const brands = await sql`select id, name from brand`;
const brandByNorm = new Map();
for (const b of brands) brandByNorm.set(norm(b.name), b);
const jobs = []; // {kind, id, dest, file}
const unmatchedBrands = [], missingFiles = [];
for (const [name, file] of lines("brand-logos.txt")) {
  const b = brandByNorm.get(norm(name));
  if (!b) { unmatchedBrands.push(name); continue; }
  const local = path.join(exportDir, "brands", file);
  if (!fs.existsSync(local)) { missingFiles.push(file); continue; }
  jobs.push({ kind: "brand", id: b.id, dest: `brands/${file}`, file: local, label: name });
}

// ---- categories ----
const cats = await sql`select id, name, parent_id from category`;
const pathOf = (c) => { const p = [c.name]; let cur = c; while (cur.parent_id) { cur = cats.find((x) => x.id === cur.parent_id); p.unshift(cur.name); } return p.map(norm).join(">"); };
const catByPath = new Map(cats.map((c) => [pathOf(c), c]));
const unmatchedCats = [];
for (const [p, id] of lines("category-images.txt")) {
  const c = catByPath.get(p.split(" > ").map(norm).join(">"));
  if (!c) { unmatchedCats.push(p); continue; }
  const file = ["big", "list"].map((s) => `${id}_${s}.jpg`).find((f) => fs.existsSync(path.join(exportDir, "categories", f)));
  if (!file) { missingFiles.push(`${id}_*`); continue; }
  jobs.push({ kind: "category", id: c.id, dest: `categories/${file}`, file: path.join(exportDir, "categories", file), label: p });
}

const inBucket = new Set((await sql`select name from storage.objects where bucket_id=${BUCKET} and (name like 'brands/%' or name like 'categories/%')`).map((o) => o.name));
const toUpload = jobs.filter((j) => !inBucket.has(j.dest));
console.log(`Brands in DB: ${brands.length}; logo mappings: ${lines("brand-logos.txt").length}
  matched: ${jobs.filter((j) => j.kind === "brand").length}   no such brand in DB: ${unmatchedBrands.length}
Categories matched: ${jobs.filter((j) => j.kind === "category").length}   unmatched: ${unmatchedCats.length} ${unmatchedCats.slice(0, 5).join("; ")}
Files missing locally: ${missingFiles.length}   to upload: ${toUpload.length}   columns exist: ${hasCols}`);
if (DRY) { await sql.end(); process.exit(0); }

let up = 0, fail = 0;
for (const j of toUpload) {
  const { error } = await sb.storage.from(BUCKET).upload(j.dest, fs.readFileSync(j.file), { contentType: "image/jpeg", upsert: false });
  if (error && !/exists|Duplicate/i.test(error.message)) { fail++; j.failed = true; console.warn("upload failed", j.dest, error.message); } else up++;
}
let linked = 0;
for (const j of jobs) {
  if (j.failed) continue;
  if (j.kind === "brand") await sql`update brand set logo_path = ${j.dest} where id = ${j.id}`;
  else await sql`update category set image_path = ${j.dest} where id = ${j.id}`;
  linked++;
}
console.log(`Uploaded ${up} (failed ${fail}); linked ${linked}`);
await sql.end();
