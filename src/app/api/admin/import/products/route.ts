import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { importProductsFromXML } from "@/lib/import/product-importer";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function errPayload(err: any) {
  const status = Number(err?.status ?? err?.statusCode ?? 500);
  const message = String(err?.message || "Eroare internă.");
  const isDev = process.env.NODE_ENV !== "production";
  return {
    status: status >= 400 && status <= 599 ? status : 500,
    body: {
      ok: false,
      error: message,
      ...(isDev ? { debug: { stack: err?.stack } } : {}),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireStaff(req, ["ADMIN"]);

    const contentType = req.headers.get("content-type") || "";
    const startTime = Date.now();

    // Handle XML file upload
    if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      const xmlContent = await req.text();

      if (!xmlContent) {
        return json(
          { ok: false, error: "XML content is empty" },
          400
        );
      }

      console.log("[Import] ============================================");
      console.log("[Import] Starting product import from XML...");
      console.log("[Import] Content size:", (xmlContent.length / 1024).toFixed(2), "KB");

      const progress = await importProductsFromXML(xmlContent);
      const duration = Date.now() - startTime;

      console.log("[Import] ============================================");
      console.log("[Import] Import completed successfully");
      console.log("[Import] Duration:", duration, "ms");
      console.log("[Import] Total records:", progress.total);
      console.log("[Import] Successful:", progress.successful);
      console.log("[Import] Failed:", progress.failed);
      if (progress.errors.length > 0) {
        console.log("[Import] First error:", progress.errors[0]);
      }
      console.log("[Import] ============================================");

      return json({
        ok: true,
        message: "Import completed",
        progress,
        details: {
          duration_ms: duration,
          success_rate: progress.total > 0 ? ((progress.successful / progress.total) * 100).toFixed(2) + "%" : "0%",
        }
      });
    }

    // Handle FormData with file
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return json(
          { ok: false, error: "No file provided" },
          400
        );
      }

      if (!file.name.endsWith(".xml")) {
        return json(
          { ok: false, error: "File must be XML format" },
          400
        );
      }

      const xmlContent = await file.text();

      if (!xmlContent) {
        return json(
          { ok: false, error: "XML file is empty" },
          400
        );
      }

      console.log("[Import] ============================================");
      console.log(`[Import] Starting product import from file: ${file.name}`);
      console.log("[Import] File size:", (file.size / 1024).toFixed(2), "KB");
      console.log("[Import] Content size:", (xmlContent.length / 1024).toFixed(2), "KB");

      const progress = await importProductsFromXML(xmlContent);
      const duration = Date.now() - startTime;

      console.log("[Import] ============================================");
      console.log("[Import] Import completed successfully");
      console.log("[Import] Duration:", duration, "ms");
      console.log("[Import] Total records:", progress.total);
      console.log("[Import] Successful:", progress.successful);
      console.log("[Import] Failed:", progress.failed);
      if (progress.errors.length > 0) {
        console.log("[Import] Sample errors:");
        progress.errors.slice(0, 3).forEach((err, idx) => {
          console.log(`  ${idx + 1}. Row ${err.row}: ${err.error}`);
        });
        if (progress.errors.length > 3) {
          console.log(`  ... and ${progress.errors.length - 3} more errors`);
        }
      }
      console.log("[Import] ============================================");

      return json({
        ok: true,
        message: `Imported from ${file.name}`,
        progress,
        details: {
          file_name: file.name,
          file_size_kb: (file.size / 1024).toFixed(2),
          duration_ms: duration,
          success_rate: progress.total > 0 ? ((progress.successful / progress.total) * 100).toFixed(2) + "%" : "0%",
        }
      });
    }

    return json(
      { ok: false, error: "Unsupported content type. Use XML or FormData with file." },
      415
    );
  } catch (err: any) {
    console.error("[Import] ============================================");
    console.error("[Import] Import FAILED with error:");
    console.error("[Import] Error message:", err?.message);
    console.error("[Import] Error stack:", err?.stack);
    console.error("[Import] ============================================");
    const p = errPayload(err);
    return json(p.body, p.status);
  }
}

// GET - Show import statistics
export async function GET(req: NextRequest) {
  try {
    await requireStaff(req, ["ADMIN"]);

    const stats = await Promise.all([
      fetch("/_api/admin/products").then((r) => r.json()),
    ]).catch(() => ({}));

    return json({
      ok: true,
      message: "Ready for product import",
      info: {
        mainWarehouseId: "19995c62-08f7-425f-9e34-5ca5a268c733",
        priceColumn: "Price11763",
        buyPriceCalculation: "Price11763 / 1.20",
        profitMargin: "20%",
        stockDefault: 1,
      },
    });
  } catch (err: any) {
    console.error("/api/admin/import/products GET failed", err);
    const p = errPayload(err);
    return json(p.body, p.status);
  }
}
