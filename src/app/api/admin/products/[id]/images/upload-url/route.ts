import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ["ADMIN"]); // keep strict for uploads
    const { id: productId } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const ext = String(body?.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

    const fileName = `${crypto.randomUUID()}.${ext}`;
    const path = `${productId}/${fileName}`;

    const sb = supabaseAdmin();
    const { data, error } = await sb.storage.from("product-images").createSignedUploadUrl(path);
    if (error) return json({ ok: false, error: error.message }, 400);

    // data: { signedUrl, path, token }
    return json({ ok: true, ...data });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}