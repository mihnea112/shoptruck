#!/usr/bin/env python3 -I
"""
Read-only dry run for the catalog replacement. Writes NOTHING to Supabase.

Usage: python3 -I scripts/dry-run-import.py <export_dir> [xml_file ...]
Defaults to the two newest ExportProducts XML files, merged by ProductCode.

Reports: products found, image refs, how many resolve to a local file in
<export_dir>/products, and (if .env is readable) what is already in Supabase.
"""
import json
import os
import re
import sys
import urllib.request
from collections import Counter
from urllib.parse import urlparse

CELL = re.compile(r"<Cell[^>]*>(?:<Data[^>]*>(?:<!\[CDATA\[(.*?)\]\]>|([^<]*))</Data>)?</Cell>", re.S)
BUCKET = "product-images"


def read_rows(path):
    """Stream an Excel-2003-XML sheet, yielding dicts keyed by header."""
    hdr, buf = None, ""
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if "<Row>" in line:
                buf = ""
            buf += line
            if "</Row>" not in line:
                continue
            vals = [a or b for a, b in CELL.findall(buf)]
            if hdr is None:
                if "ProductCode" in vals:
                    # strip the " - P12345" property suffix like the app importer does
                    hdr = [re.sub(r"\s+-\s+P\d+$", "", h) for h in vals]
                continue
            row = {}
            for h, v in zip(hdr, vals):
                if h and (h not in row or not row[h]):
                    row[h] = v.strip()
            yield row


def split_images(v):
    return [p for p in re.split(r"[#,;\s]+", v or "") if p.startswith("http") or "." in p]


def load_env(path):
    env = {}
    try:
        for line in open(path):
            m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)$", line)
            if m:
                env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    except OSError:
        pass
    return env


def sb(env, method, path, body=None, headers=None):
    req = urllib.request.Request(
        env["NEXT_PUBLIC_SUPABASE_URL"] + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"],
            "Content-Type": "application/json",
            **(headers or {}),
        },
    )
    return urllib.request.urlopen(req, timeout=30)


def rest_count(env, table):
    r = sb(env, "GET", f"/rest/v1/{table}?select=id", headers={"Prefer": "count=exact", "Range": "0-0"})
    return int(r.headers["Content-Range"].split("/")[-1])


def main():
    export_dir = sys.argv[1]
    exp = os.path.join(export_dir, "ExportProducts")
    # default: every export file, oldest first so the newest version of a product wins
    files = sys.argv[2:] or [
        os.path.join(exp, n)
        for n in sorted(os.listdir(exp), key=lambda n: os.path.getmtime(os.path.join(exp, n)))
        if n.endswith(".xml")
    ]
    local = set()
    for sub in ("products", "gallery"):
        d = os.path.join(export_dir, sub)
        local |= {f"{sub}/{f}".lower() for f in os.listdir(d)}

    products = {}
    for f in files:
        n = new = 0
        for row in read_rows(f):
            code = row.get("ProductCode")
            if code:
                new += code not in products
                products[code] = row  # later file wins
                n += 1
        print(f"{os.path.basename(f)}: {n} rows, {new} new codes, union {len(products)}")

    enabled = sum(1 for p in products.values() if p.get("Enabled") == "1")
    no_price = sum(1 for p in products.values() if not p.get("Price11763"))
    no_name = sum(1 for p in products.values() if not p.get("ProductName"))
    refs, missing, per_product = [], [], Counter()
    sample_add = None
    for code, p in products.items():
        imgs = split_images(p.get("Image", "")) + split_images(p.get("AddImages", ""))
        if p.get("AddImages") and not sample_add:
            sample_add = p["AddImages"][:300]
        per_product[len(imgs)] += 1
        for u in imgs:
            parts = urlparse(u).path.split("/")
            base = "/".join(parts[-2:]) if len(parts) > 1 else parts[-1]
            refs.append((code, base))
            if base.lower() not in local:
                missing.append((code, base))
    uniq = {b.lower() for _, b in refs}

    print("\n== Export ==")
    print(f"unique products (by ProductCode): {len(products)}  enabled: {enabled}")
    print(f"missing Price11763 (importer would fail them): {no_price}  missing name: {no_name}")
    print(f"image refs: {len(refs)}  unique files: {len(uniq)}  not found locally: {len(missing)}")
    print("images per product:", dict(sorted(per_product.items())))
    print("sample AddImages value:", sample_add)
    print("sample missing:", missing[:5])
    print(f"local products/+gallery/ files: {len(local)}  unreferenced by any product: {len(local - uniq)}")

    env = load_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
    if "SUPABASE_SERVICE_ROLE_KEY" not in env:
        print("\n(no Supabase env, skipped remote comparison)")
        return
    print("\n== Supabase (read-only) ==")
    for t in ("product", "product_image"):
        try:
            print(f"{t} rows: {rest_count(env, t)}")
        except Exception as e:  # noqa: BLE001
            print(f"{t}: count failed ({e})")
    try:
        r = sb(env, "POST", f"/storage/v1/object/list/{BUCKET}", {"prefix": "", "limit": 1000, "offset": 0})
        top = json.load(r)
        print(f"bucket '{BUCKET}' top-level entries (first 1000): {len(top)}")
        r = sb(env, "POST", f"/storage/v1/object/list/{BUCKET}", {"prefix": "import", "limit": 1000, "offset": 0})
        print(f"already under import/ (first 1000): {len(json.load(r))}")
    except Exception as e:  # noqa: BLE001
        print(f"bucket listing failed ({e})")


if __name__ == "__main__":
    main()
