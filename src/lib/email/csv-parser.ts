export interface CSVContactRow {
  email: string;
  first_name?: string;
  last_name?: string;
  tags: string[];
}

/**
 * Parse CSV content and extract contact rows
 * Expected columns: email, first_name, last_name, tags
 * Tags column is comma-separated and will be split into an array
 *
 * @param csvContent Raw CSV string
 * @param maxRows Maximum rows to parse (default: no limit)
 * @returns Array of parsed contact rows with validation
 */
export function parseCSV(csvContent: string, maxRows?: number): CSVContactRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV deve avere almeno o header e o minimo 1 riga di dati.");
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  const emailIndex = headers.indexOf("email");
  const firstNameIndex = headers.indexOf("first_name");
  const lastNameIndex = headers.indexOf("last_name");
  const tagsIndex = headers.indexOf("tags");

  if (emailIndex === -1) {
    throw new Error(
      "CSV deve contenere colonna 'email' (obbligatoria)."
    );
  }

  const rows: CSVContactRow[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    if (maxRows && rows.length >= maxRows) break;

    try {
      const values = parseCSVLine(line);

      const email = (values[emailIndex] || "").trim().toLowerCase();
      if (!email) continue; // Skip rows without email
      if (!isValidEmail(email)) {
        console.warn(`[CSV Parse] Riga ${i + 1}: email non valido: ${email}`);
        continue;
      }

      // Deduplicate by email within import
      if (seenEmails.has(email)) {
        console.warn(`[CSV Parse] Riga ${i + 1}: email duplicato: ${email}`);
        continue;
      }
      seenEmails.add(email);

      const firstName = firstNameIndex >= 0 ? (values[firstNameIndex] || "").trim() : "";
      const lastName = lastNameIndex >= 0 ? (values[lastNameIndex] || "").trim() : "";
      const tagsRaw = tagsIndex >= 0 ? (values[tagsIndex] || "").trim() : "";

      // Parse tags (comma-separated)
      const tags = tagsRaw
        ? tagsRaw
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0)
        : [];

      rows.push({
        email,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        tags,
      });
    } catch (error) {
      console.error(`[CSV Parse] Errore alla riga ${i + 1}:`, error);
      continue;
    }
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields and escaped quotes
 * @param line Raw CSV line
 * @returns Array of field values
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      // Field separator
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  fields.push(current);

  return fields;
}

/**
 * Validate email format (basic)
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
