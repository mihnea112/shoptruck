// Email Templates with ShopTruck branding

const brandColor = "#feab1f";
const darkColor = "#1e293b";
const lightBg = "#f8fafc";

function emailHeader(): string {
  return `
    <div style="background: white; border-bottom: 2px solid ${brandColor}; padding: 20px; text-align: center;">
      <h1 style="color: ${darkColor}; margin: 0; font-size: 28px; font-weight: bold;">
        ShopTruck
      </h1>
      <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">
        Piese și echipamente auto de calitate
      </p>
    </div>
  `;
}

function emailFooter(): string {
  return `
    <div style="background: ${lightBg}; padding: 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 10px 0;">
        <strong>ShopTruck</strong><br>
        Telefon: +40 xxx xxx xxx<br>
        Email: contact@shoptruck.ro<br>
        Website: shoptruck.ro
      </p>
      <p style="margin: 15px 0 0 0; border-top: 1px solid #cbd5e1; padding-top: 15px;">
        <a href="https://shoptruck.ro/dorinte" style="color: ${brandColor}; text-decoration: none;">
          Lista de dorințe
        </a> |
        <a href="https://shoptruck.ro/account" style="color: ${brandColor}; text-decoration: none;">
          Contul meu
        </a> |
        <a href="https://shoptruck.ro" style="color: ${brandColor}; text-decoration: none;">
          Catalog
        </a>
      </p>
      <p style="margin: 15px 0 0 0;">
        © 2024 ShopTruck. Toate drepturile rezervate.
      </p>
    </div>
  `;
}

function button(text: string, href: string): string {
  return `
    <a href="${href}" style="
      display: inline-block;
      background: ${brandColor};
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 24px;
      font-weight: bold;
      margin: 15px 0;
    ">${text}</a>
  `;
}

// Order Confirmation Email
export function orderConfirmationTemplate(data: {
  orderNumber: string;
  customerName: string;
  orderDate: string;
  items: Array<{ name: string; quantity: number; price: number; slug: string }>;
  subtotal: number;
  tax: number;
  total: number;
  trackingUrl?: string;
}): { subject: string; html: string; text: string } {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
        <a href="https://shoptruck.ro/produs/${item.slug}" style="color: ${brandColor}; text-decoration: none; font-weight: 500;">
          ${item.name}
        </a>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">
        ${formatRON(item.price * item.quantity)}
      </td>
    </tr>
  `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: ${lightBg}; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        ${emailHeader()}

        <div style="padding: 30px;">
          <h2 style="color: ${darkColor}; margin: 0 0 20px 0;">Comandă confirmată!</h2>
          <p style="color: #64748b; line-height: 1.6; margin: 0;">
            Bună ${data.customerName},<br><br>
            Mulțumim pentru comanda ta! Am primit-o cu succes și am început procesarea.
          </p>

          <div style="background: ${lightBg}; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${brandColor};">
            <p style="margin: 0; color: #64748b;">
              <strong>Numărul comenzii:</strong> ${data.orderNumber}<br>
              <strong>Data comenzii:</strong> ${data.orderDate}<br>
              ${data.trackingUrl ? `<a href="${data.trackingUrl}" style="color: ${brandColor}; text-decoration: none;"><strong>Urmăreste comanda →</strong></a>` : ""}
            </p>
          </div>

          <h3 style="color: ${darkColor}; margin: 25px 0 15px 0;">Detaliile comenzii:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: ${lightBg};">
                <th style="padding: 10px; text-align: left; font-weight: bold; color: ${darkColor}; border: 1px solid #e2e8f0;">Produs</th>
                <th style="padding: 10px; text-align: center; font-weight: bold; color: ${darkColor}; border: 1px solid #e2e8f0;">Cant.</th>
                <th style="padding: 10px; text-align: right; font-weight: bold; color: ${darkColor}; border: 1px solid #e2e8f0;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="text-align: right; margin: 20px 0; padding: 20px 0; border-top: 2px solid #e2e8f0;">
            <p style="margin: 5px 0; color: #64748b;">
              Subtotal: <strong>${formatRON(data.subtotal)}</strong>
            </p>
            <p style="margin: 5px 0; color: #64748b;">
              TVA: <strong>${formatRON(data.tax)}</strong>
            </p>
            <p style="margin: 10px 0 0 0; font-size: 18px; color: ${darkColor};">
              Total: <strong>${formatRON(data.total)}</strong>
            </p>
          </div>

          <div style="text-align: center;">
            ${button("Vizualizează comanda", `https://shoptruck.ro/account`)}
          </div>

          <p style="color: #64748b; line-height: 1.6; margin: 25px 0 0 0; font-size: 14px;">
            <strong>Ce urmează?</strong><br>
            • Comanda ta va fi pregătită pentru expediere în 24-48 ore<br>
            • Vei primi un email cu detaliile de livrare<br>
            • Poți urmări oricând statusul comenzii în contul tău
          </p>
        </div>

        ${emailFooter()}
      </div>
    </body>
    </html>
  `;

  const text = `
ShopTruck - Comandă confirmată

Bună ${data.customerName},

Mulțumim pentru comanda ta! Am primit-o cu succes.

Numărul comenzii: ${data.orderNumber}
Data comenzii: ${data.orderDate}

--- Detaliile comenzii ---
${data.items.map((i) => `${i.name} x${i.quantity}: ${formatRON(i.price * i.quantity)}`).join("\n")}

Subtotal: ${formatRON(data.subtotal)}
TVA: ${formatRON(data.tax)}
Total: ${formatRON(data.total)}

Vizualizează comanda: https://shoptruck.ro/account

Contact: contact@shoptruck.ro
Telefon: +40 xxx xxx xxx
  `;

  return {
    subject: `Comandă confirmată - ${data.orderNumber}`,
    html,
    text,
  };
}

// Order Status Update Email
export function orderStatusTemplate(data: {
  orderNumber: string;
  customerName: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
}): { subject: string; html: string; text: string } {
  const statusConfig: Record<string, { title: string; message: string; icon: string }> = {
    processing: {
      title: "Comanda în procesare",
      message: "Comanda ta este în curs de pregătire și va fi expediată în curând.",
      icon: "📦",
    },
    shipped: {
      title: "Comanda expediată",
      message: "Comanda ta a fost expediată și este în drum spre tine.",
      icon: "🚚",
    },
    delivered: {
      title: "Comanda livrata",
      message: "Comanda ta a fost livrată. Sperăm că ești mulțumit!",
      icon: "✓",
    },
    cancelled: {
      title: "Comanda anulata",
      message: "Comanda ta a fost anulată. Dacă ai întrebări, contactează-ne.",
      icon: "✕",
    },
  };

  const config = statusConfig[data.status];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${lightBg}; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        ${emailHeader()}

        <div style="padding: 30px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 48px; margin-bottom: 15px;">${config.icon}</div>
            <h2 style="color: ${darkColor}; margin: 0; font-size: 24px;">${config.title}</h2>
          </div>

          <p style="color: #64748b; line-height: 1.6; margin: 0;">
            Bună ${data.customerName},<br><br>
            ${config.message}
          </p>

          <div style="background: ${lightBg}; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${brandColor};">
            <p style="margin: 0; color: #64748b;">
              <strong>Numărul comenzii:</strong> ${data.orderNumber}
              ${data.trackingNumber ? `<br><strong>Codul de urmărire:</strong> ${data.trackingNumber}` : ""}
            </p>
            ${data.trackingUrl ? `<a href="${data.trackingUrl}" style="color: ${brandColor}; text-decoration: none; margin-top: 10px; display: inline-block;"><strong>Urmăreste comanda →</strong></a>` : ""}
          </div>

          ${data.notes ? `<div style="color: #64748b; line-height: 1.6; background: #fff5e6; padding: 15px; border-radius: 8px; margin: 15px 0;"><strong>Notă:</strong> ${data.notes}</div>` : ""}

          <div style="text-align: center;">
            ${button("Vezi statusul comenzii", `https://shoptruck.ro/account`)}
          </div>
        </div>

        ${emailFooter()}
      </div>
    </body>
    </html>
  `;

  const text = `
ShopTruck - ${config.title}

Bună ${data.customerName},

${config.message}

Numărul comenzii: ${data.orderNumber}
${data.trackingNumber ? `Codul de urmărire: ${data.trackingNumber}` : ""}
${data.notes ? `\nNotă: ${data.notes}` : ""}

Vizualizează comanda: https://shoptruck.ro/account

Contact: contact@shoptruck.ro
Telefon: +40 xxx xxx xxx
  `;

  return {
    subject: `${config.title} - ${data.orderNumber}`,
    html,
    text,
  };
}

// Helper function to format RON
function formatRON(amount: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(amount);
}

export { formatRON };
