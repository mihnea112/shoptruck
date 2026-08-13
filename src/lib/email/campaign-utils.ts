/**
 * Generate unsubscribe URL for a contact
 * Token is base64-encoded contact ID
 *
 * @param contactId UUID of the contact
 * @param appUrl Base URL of the application (from NEXT_PUBLIC_APP_URL)
 * @returns Full unsubscribe URL
 */
export function generateUnsubscribeUrl(contactId: string, appUrl: string): string {
  const token = Buffer.from(contactId).toString("base64");
  return `${appUrl}/api/public/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Inject unsubscribe link into HTML email body
 * Appends a footer with Romanian unsubscribe text
 *
 * @param html Original HTML body
 * @param contactId UUID of the contact
 * @param appUrl Base URL of the application
 * @returns HTML with injected unsubscribe footer
 */
export function injectUnsubscribeLink(
  html: string,
  contactId: string,
  appUrl: string
): string {
  const unsubscribeUrl = generateUnsubscribeUrl(contactId, appUrl);

  // Replace placeholder if present in the template
  if (html.includes("[UNSUBSCRIBE_LINK]")) {
    return html.replaceAll("[UNSUBSCRIBE_LINK]", unsubscribeUrl);
  }

  // Fallback: append footer
  const footer = `
<p style="font-size:11px;color:#999;text-align:center;margin-top:32px;">
  Nu mai doriți să primiți emailuri?
  <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">Dezabonați-vă aici</a>
</p>
`;

  if (html.includes("</body>")) {
    return html.replace("</body>", footer + "</body>");
  } else if (html.includes("</html>")) {
    return html.replace("</html>", footer + "</html>");
  } else {
    return html + footer;
  }
}

/**
 * Convert HTML to plain text (very basic)
 * Removes HTML tags and common formatting
 *
 * @param html HTML string
 * @returns Plain text version
 */
export function stripHtmlToText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, "");

  // Remove HTML comments
  text = text.replace(/<!--.*?-->/g, "");

  // Replace common block elements with newlines
  text = text.replace(/<(br|p|div|h[1-6]|blockquote|li)[^>]*>/gi, "\n");
  text = text.replace(/<\/(p|div|h[1-6]|blockquote|li)>/gi, "\n");

  // Replace table elements
  text = text.replace(/<tr[^>]*>/gi, "\n");
  text = text.replace(/<td[^>]*>|<th[^>]*>/gi, "\t");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Clean up whitespace
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .join("\n");

  return text;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, "g"), char);
  }

  // Handle numeric entities &#123;
  result = result.replace(/&#(\d+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });

  // Handle hex entities &#x1a;
  result = result.replace(/&#x([0-9a-f]+);/gi, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });

  return result;
}
