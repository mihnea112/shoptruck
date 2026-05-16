import { sql } from "@/lib/db";
import { XMLParser } from "fast-xml-parser";

const MAIN_WAREHOUSE_ID = "19995c62-08f7-425f-9e34-5ca5a268c733";
const PRICE_COLUMN_INDEX = 47; // Price11763 is at column 48 (0-indexed 47)

interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

interface ProductRow {
  [key: string]: string;
}

export class ProductImporter {
  private progress: ImportProgress = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  async importXML(xmlContent: string): Promise<ImportProgress> {
    try {
      console.log("[Importer] Parsing XML file...");
      const parser = new XMLParser({
        ignoreAttributes: true,
        trimValues: true,
        textNodeName: "#text",
        parseTagValue: false,
      });

      const xmlData = parser.parse(xmlContent);
      console.log("[Importer] XML parsed successfully");

      const rows = this.extractRows(xmlData);
      console.log(`[Importer] Extracted ${rows.length} product rows from XML`);

      this.progress.total = rows.length;

      for (let i = 0; i < rows.length; i++) {
        try {
          const rowNum = i + 2; // +2 because row 1 is headers, 0-indexed
          await this.processRow(rows[i], rowNum);
          this.progress.successful++;

          // Log progress every 10 rows
          if ((i + 1) % 10 === 0) {
            console.log(`[Importer] Processed ${i + 1}/${rows.length} rows (${this.progress.successful} successful, ${this.progress.failed} failed)`);
          }
        } catch (error) {
          this.progress.failed++;
          this.progress.errors.push({
            row: i + 2,
            error: String(error),
          });
          console.log(`[Importer] Error on row ${i + 2}: ${String(error)}`);
        }
        this.progress.processed++;
      }

      console.log(`[Importer] Import complete: ${this.progress.successful} successful, ${this.progress.failed} failed out of ${this.progress.total} total`);
      return this.progress;
    } catch (error) {
      console.error("[Importer] Fatal error during XML parsing:", error);
      throw new Error(`XML Import failed: ${String(error)}`);
    }
  }

  /**
   * Strip HTML tags and decode HTML entities
   */
  private stripHtmlTags(html: string): string {
    if (!html) return "";

    // Decode HTML entities
    const decoded = html
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&icirc;/g, "î")
      .replace(/&acirc;/g, "â")
      .replace(/&Icirc;/g, "Î")
      .replace(/&Acirc;/g, "Â");

    // Remove all HTML tags
    const stripped = decoded.replace(/<[^>]*>/g, "");

    // Clean up multiple spaces and newlines
    return stripped
      .replace(/\n\n+/g, "\n") // Multiple newlines to single
      .replace(/  +/g, " ") // Multiple spaces to single
      .trim();
  }

  private extractRows(xmlData: any): ProductRow[] {
    try {
      const rows = xmlData?.Workbook?.Worksheet?.Table?.Row;
      if (!rows) {
        console.error("[Importer] Could not find rows in XML structure");
        return [];
      }

      // Skip header row, convert cells to objects
      const dataRows = Array.isArray(rows) ? rows.slice(1) : [];
      console.log(`[Importer] Found ${Array.isArray(rows) ? rows.length : 1} total rows (including header)`);

      return dataRows.map((row: any, rowIndex: number) => {
        const cells = Array.isArray(row.Cell) ? row.Cell : [row.Cell];
        const obj: ProductRow = {};

        // Debug: log first row cell structure
        if (rowIndex === 0) {
          console.log("[Importer] Sample cell structure (first cell of first data row):");
          console.log("[Importer]", JSON.stringify(cells[0], null, 2).substring(0, 500));
        }
        const headers = [
          "ProductID", "ProductCode", "Category", "Stock", "Enabled", "Featured",
          "FeaturedSingle", "FeaturedCategory", "FeaturedCategorySingle", "ProductName",
          "VariantName", "MasterProductCode", "Intro", "Description", "BrandName",
          "OrderID", "Image", "AddImages", "URL", "eMagIntegrated", "FlancoIntegrated",
          "CreationDate", "ModifiedDate", "ValidFrom", "ExpireAfter", "MultipleChildren",
          "EstimatedDeliveryDate", "NumberOfDaysFromOrder", "MetaTitle", "MetaKeywords",
          "MetaDescription", "ComplementaryProductsCodes", "RecommendedProductsCodes",
          "FamilyProductsCodes", "EAN", "VAT", "PreorderAvailable", "AskForQuote",
          "BaseUnit", "SaleUnit", "UnitCoefficientSale", "ParcelPercentage", "GreenTax",
          "Price11018", "RRPrice11018", "Price11762", "RRPrice11762", "Price11763",
          "RRPrice11763", "Price11764", "RRPrice11764", "Price11765", "RRPrice11765",
          "Price11766", "RRPrice11766", "Price12811", "RRPrice12811", "Price14332",
          "RRPrice14332", "Shipping221", "Shipping252", "Shipping253", "Shipping254",
          "eMAGCommisiontype", "eMAGCommisionvalue", "TipProdus", "Garantieluni",
          "eMAGHandlingtime", "Echivalenta", "Brand", "Weight", "CurentPornireA",
          "AmperajAh", "ProductImage", "AddImages2", "DetaliiProduseHTML", "EANBarcode",
          "externalID", "StagingPrice", "ModeleMAG", "TipVehiculeMAG", "MarcaeMAG",
          "TipProduseMAG", "eMAGProductName", "TipProduseMAG2", "DescriptioneMAG",
          "EmagHeightmm", "EmagLengthmm", "EmagWidthmm", "EmagWeightg", "Length",
          "TipProduseMAG3", "WeightFinal"
        ];

        cells.forEach((cell: any, index: number) => {
          if (!headers[index]) return;

          // Extract cell value from XML
          let value = "";

          if (!cell) {
            value = "";
          } else if (!cell.Data) {
            value = "";
          } else if (typeof cell.Data === "string") {
            // Cell.Data is already a string
            value = cell.Data;
          } else if (cell.Data["#text"]) {
            // Cell.Data is an object with #text property (text content)
            value = cell.Data["#text"];
          } else if (typeof cell.Data === "object") {
            // Cell.Data is an object, try to get text content
            const keys = Object.keys(cell.Data).filter(k => k !== "#text");
            if (keys.length > 0) {
              const firstKey = keys[0];
              if (typeof cell.Data[firstKey] === "string") {
                value = cell.Data[firstKey];
              }
            }
          }

          // Convert to string and trim
          obj[headers[index]] = String(value).trim();
        });

        return obj;
      });
    } catch (error) {
      console.error("Error extracting rows:", error);
      return [];
    }
  }

  private async processRow(row: ProductRow, rowNumber: number): Promise<void> {
    // Validate required fields
    if (!row.ProductCode || !row.ProductName) {
      throw new Error("Missing ProductCode or ProductName");
    }

    // Check if product with this SKU already exists
    const productCode = row.ProductCode.trim();
    const existingProduct = await sql`
      SELECT id FROM product WHERE sku = ${productCode} LIMIT 1
    ` as any[];

    if (existingProduct && existingProduct.length > 0) {
      console.log(`[Importer] Skipping row ${rowNumber}: Product with SKU "${productCode}" already exists`);
      return;
    }

    // Parse data
    const productName = row.ProductName.trim();
    const rawDescription = row.Description?.trim() || "";
    const description = this.stripHtmlTags(rawDescription); // Remove HTML tags
    const categoryPath = row.Category?.trim() || "";
    const brandName = row.BrandName?.trim() || "";
    const stock = Math.max(1, parseInt(row.Stock || "1") || 1);
    const isActive = row.Enabled === "1";
    const imageUrl = row.Image?.trim() || "";
    const ean = row.EAN?.trim() || "";
    const equivalentCodes = row.ComplementaryProductsCodes?.trim() || "";
    const vatRate = parseFloat(row.VAT || "0.21");

    // Parse price
    const priceStr = (row.Price11763 || "").trim();
    if (!priceStr) {
      throw new Error("Missing Price11763");
    }
    const price11763 = parseFloat(priceStr);
    if (isNaN(price11763) || price11763 <= 0) {
      throw new Error(`Invalid Price11763: "${priceStr}" (parsed as ${price11763})`);
    }

    // Calculate buy_price_net (x + 20% = price, so x = price / 1.2)
    const buyPriceNet = price11763 / 1.2;
    const profitMarginPct = 20;

    console.log(`[Importer] Processing: ${productCode} | ${productName} | Price: ${price11763} | Stock: ${stock}`);

    // Generate unique product slug
    let productSlug = this.generateSlug(productName);
    let finalSlug = productSlug;
    let slugCounter = 1;

    while (true) {
      const existingSlug = await sql`
        SELECT id FROM product WHERE slug = ${finalSlug} LIMIT 1
      ` as any[];

      if (!existingSlug || existingSlug.length === 0) {
        break; // Slug is unique
      }

      // Slug exists, try with counter
      finalSlug = `${productSlug}-${slugCounter}`;
      slugCounter++;
    }

    // Get or create category
    const categoryId = categoryPath
      ? await this.getOrCreateCategory(categoryPath)
      : null;
    if (categoryPath) {
      console.log(`[Importer]   └─ Category: ${categoryPath} (ID: ${categoryId})`);
    }

    // Get or create brand
    if (brandName && brandName === "[object Object]") {
      console.warn(`[Importer]   ⚠️  WARNING: Brand name is "[object Object]" - XML parsing issue for row ${rowNumber}`);
      throw new Error(`Brand parsing error: received object instead of string for row ${rowNumber}`);
    }
    const brandId = brandName ? await this.getOrCreateBrand(brandName) : null;
    if (brandName) {
      console.log(`[Importer]   └─ Brand: ${brandName} (ID: ${brandId})`);
    }

    // Get tax_rate_id
    const taxRateId = await this.getTaxRateId(vatRate);
    console.log(`[Importer]   └─ Tax Rate: ${(vatRate * 100).toFixed(0)}% (ID: ${taxRateId})`);

    // Insert product
    const productResult = await sql`
      INSERT INTO product (
        sku,
        name,
        slug,
        brand_id,
        category_id,
        tax_rate_id,
        buy_price_net,
        profit_margin_pct,
        is_active,
        description,
        stock_on_hand,
        stock_reserved,
        uom,
        created_at
      )
      VALUES (
        ${productCode},
        ${productName},
        ${finalSlug},
        ${brandId ? sql`${brandId}::uuid` : null},
        ${categoryId ? sql`${categoryId}::uuid` : null},
        ${taxRateId}::uuid,
        ${buyPriceNet},
        ${profitMarginPct},
        ${isActive},
        ${description},
        ${stock},
        0,
        'buc',
        now()
      )
      RETURNING id
    `;

    const productId = (productResult as any[])[0]?.id;
    if (!productId) {
      throw new Error("Failed to insert product");
    }
    console.log(`[Importer]   └─ Product created: ID ${productId}`);

    // Insert product code (primary)
    await sql`
      INSERT INTO product_code (
        product_id,
        code_id,
        is_primary,
        code_kind,
        created_at
      )
      VALUES (
        ${productId}::uuid,
        ${productCode},
        true,
        'SKU',
        now()
      )
    `;
    console.log(`[Importer]   └─ SKU added: ${productCode}`);

    // Insert EAN codes if present
    if (ean) {
      const eanCodes = ean.split("#").map((code) => code.trim());
      let eancodeCount = 0;
      for (const code of eanCodes) {
        if (code) {
          await sql`
            INSERT INTO product_code (
              product_id,
              code_id,
              is_primary,
              code_kind,
              created_at
            )
            VALUES (
              ${productId}::uuid,
              ${code},
              false,
              'EAN',
              now()
            )
            ON CONFLICT DO NOTHING
          `;
          eancodeCount++;
        }
      }
      if (eancodeCount > 0) {
        console.log(`[Importer]   └─ EAN codes added: ${eancodeCount}`);
      }
    }

    // Insert equivalent codes if present
    if (equivalentCodes) {
      const equivCodes = equivalentCodes.split("#").map((code) => code.trim());
      let equivCount = 0;
      for (const code of equivCodes) {
        if (code && code !== productCode) { // Don't add duplicate of main SKU
          await sql`
            INSERT INTO product_code (
              product_id,
              code_id,
              is_primary,
              code_kind,
              created_at
            )
            VALUES (
              ${productId}::uuid,
              ${code},
              false,
              'EQUIVALENT',
              now()
            )
            ON CONFLICT DO NOTHING
          `;
          equivCount++;
        }
      }
      if (equivCount > 0) {
        console.log(`[Importer]   └─ Equivalent codes added: ${equivCount}`);
      }
    }

    // Insert image if present
    if (imageUrl) {
      await sql`
        INSERT INTO product_image (
          product_id,
          storage_path,
          alt,
          sort_order,
          is_primary,
          created_at
        )
        VALUES (
          ${productId}::uuid,
          ${imageUrl},
          ${productName},
          0,
          true,
          now()
        )
      `;
      console.log(`[Importer]   └─ Image added: ${imageUrl}`);
    }

    // Insert inventory balance for main warehouse
    await sql`
      INSERT INTO inventory_balance (
        product_id,
        warehouse_id,
        stock_on_hand,
        stock_reserved
      )
      VALUES (
        ${productId}::uuid,
        ${MAIN_WAREHOUSE_ID}::uuid,
        ${stock},
        0
      )
      ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        stock_on_hand = ${stock},
        updated_at = now()
    `;
    console.log(`[Importer]   └─ Stock added to warehouse: ${stock} units`);
  }

  private async getOrCreateCategory(categoryPath: string): Promise<string> {
    const categories = categoryPath.split("#").map((cat) => cat.trim());
    let parentId: string | null = null;

    for (const categoryName of categories) {
      if (!categoryName) continue;

      // Case-sensitive search by name at the same parent level
      let existingByName;
      if (parentId === null) {
        existingByName = await sql`
          SELECT id FROM category
          WHERE name = ${categoryName} AND parent_id IS NULL
          LIMIT 1
        ` as any[];
      } else {
        existingByName = await sql`
          SELECT id FROM category
          WHERE name = ${categoryName} AND parent_id = ${parentId}::uuid
          LIMIT 1
        ` as any[];
      }

      if (existingByName && existingByName.length > 0) {
        parentId = existingByName[0].id;
        console.log(`[Importer]     Found existing category by name: "${categoryName}"`);
        continue;
      }

      // If not found by name, try to create with generated slug
      let slug = this.generateSlug(categoryName);
      let finalSlug = slug;
      let slugCounter = 1;

      // Check if slug already exists and make it unique if needed
      while (true) {
        const existingSlug = await sql`
          SELECT id FROM category WHERE slug = ${finalSlug} LIMIT 1
        ` as any[];

        if (!existingSlug || existingSlug.length === 0) {
          break; // Slug is unique
        }

        // Slug exists, try with counter
        finalSlug = `${slug}-${slugCounter}`;
        slugCounter++;
      }

      // Create new category
      const result = await sql`
        INSERT INTO category (
          name,
          slug,
          parent_id,
          created_at
        )
        VALUES (
          ${categoryName},
          ${finalSlug},
          ${parentId ? sql`${parentId}::uuid` : null},
          now()
        )
        RETURNING id
      ` as any[];

      parentId = result[0]?.id;
      console.log(`[Importer]     Created new category: "${categoryName}" (slug: "${finalSlug}")`);
    }

    return parentId || "";
  }

  private async getOrCreateBrand(brandName: string): Promise<string> {
    // Case-sensitive search by name
    const existingByName = await sql`
      SELECT id FROM brand
      WHERE name = ${brandName}
      LIMIT 1
    ` as any[];

    if (existingByName && existingByName.length > 0) {
      console.log(`[Importer]     Found existing brand by name: "${brandName}"`);
      return (existingByName as any[])[0].id;
    }

    // If not found by name, try to create with generated slug
    let slug = this.generateSlug(brandName);
    let finalSlug = slug;
    let slugCounter = 1;

    // Check if slug already exists and make it unique if needed
    while (true) {
      const existingSlug = await sql`
        SELECT id FROM brand WHERE slug = ${finalSlug} LIMIT 1
      ` as any[];

      if (!existingSlug || existingSlug.length === 0) {
        break; // Slug is unique
      }

      // Slug exists, try with counter
      finalSlug = `${slug}-${slugCounter}`;
      slugCounter++;
    }

    // Create new brand
    const result = await sql`
      INSERT INTO brand (
        name,
        slug,
        created_at
      )
      VALUES (
        ${brandName},
        ${finalSlug},
        now()
      )
      RETURNING id
    ` as any[];

    console.log(`[Importer]     Created new brand: "${brandName}" (slug: "${finalSlug}")`);
    return (result as any[])[0]?.id || "";
  }

  private async getTaxRateId(vatRate: number): Promise<string> {
    // Find tax rate matching VAT percentage
    const result = await sql`
      SELECT id FROM tax_rate
      WHERE rate = ${vatRate}
      LIMIT 1
    `;

    if (result && (result as any[]).length > 0) {
      return (result as any[])[0].id;
    }

    // Default to 21% (Romanian standard)
    const defaultRate = await sql`
      SELECT id FROM tax_rate
      WHERE rate = 0.21
      LIMIT 1
    `;

    return (defaultRate as any[])[0]?.id || "";
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
}

export async function importProductsFromXML(
  xmlContent: string
): Promise<ImportProgress> {
  const importer = new ProductImporter();
  return importer.importXML(xmlContent);
}
