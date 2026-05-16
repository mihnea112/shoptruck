import nodemailer from "nodemailer";

// Types
export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Initialize SMTP transporter for transactional emails
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpTls = process.env.SMTP_TLS !== "false";

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error(
      "SMTP configuration incomplete. Provide SMTP_HOST + SMTP_USER + SMTP_PASSWORD in .env"
    );
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpTls && smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
  console.log("[Email] Using SMTP for transactional emails");

  return transporter;
}

// Send transactional email via SMTP
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = getTransporter();

    // Determine sender email based on configuration
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || "ShopTruck";

    const result = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      cc: options.cc
        ? Array.isArray(options.cc)
          ? options.cc.join(", ")
          : options.cc
        : undefined,
      bcc: options.bcc
        ? Array.isArray(options.bcc)
          ? options.bcc.join(", ")
          : options.bcc
        : undefined,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      replyTo: options.replyTo || fromEmail,
      attachments: options.attachments,
    });

    console.log("[Email Sent]", {
      to: options.to,
      subject: options.subject,
      messageId: result.messageId,
    });

    return true;
  } catch (error: any) {
    console.error("[Email Send Error]", {
      to: options.to,
      subject: options.subject,
      error: error?.message,
    });
    throw error;
  }
}

// Send email via Brevo API (for marketing campaigns only)
export async function sendBrevoEmail(options: EmailOptions): Promise<boolean> {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new Error("BREVO_API_KEY environment variable is not set");
    }

    // Determine sender email and name
    const fromEmail = process.env.BREVO_FROM_EMAIL || "noreply@shoptruck.ro";
    const fromName = process.env.SMTP_FROM_NAME || "ShopTruck";

    // Convert recipients
    const toRecipients = Array.isArray(options.to)
      ? options.to.map((email) => ({ email }))
      : [{ email: options.to }];

    const ccRecipients = options.cc
      ? Array.isArray(options.cc)
        ? options.cc.map((email) => ({ email }))
        : [{ email: options.cc }]
      : undefined;

    const bccRecipients = options.bcc
      ? Array.isArray(options.bcc)
        ? options.bcc.map((email) => ({ email }))
        : [{ email: options.bcc }]
      : undefined;

    // Prepare email data for Brevo API
    const emailData: any = {
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: toRecipients,
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text || stripHtml(options.html),
    };

    if (ccRecipients) {
      emailData.cc = ccRecipients;
    }

    if (bccRecipients) {
      emailData.bcc = bccRecipients;
    }

    if (options.replyTo) {
      emailData.replyTo = { email: options.replyTo };
    }

    // Handle attachments if provided
    if (options.attachments && options.attachments.length > 0) {
      emailData.attachment = options.attachments.map((att) => ({
        name: att.filename,
        content: att.content instanceof Buffer
          ? att.content.toString("base64")
          : typeof att.content === "string"
          ? att.content
          : Buffer.from(att.content).toString("base64"),
      }));
    }

    // Send via Brevo API
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Brevo API error: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`
      );
    }

    const result = await response.json();

    console.log("[Email Sent via Brevo]", {
      to: options.to,
      subject: options.subject,
      messageId: result.messageId,
    });

    return true;
  } catch (error: any) {
    console.error("[Brevo Email Send Error]", {
      to: options.to,
      subject: options.subject,
      error: error?.message,
    });
    throw error;
  }
}

// Send bulk emails via SMTP
export async function sendBulkEmails(
  recipients: string[],
  options: Omit<EmailOptions, "to">
): Promise<{ sent: number; failed: number; errors: any[] }> {
  const results = { sent: 0, failed: 0, errors: [] as any[] };

  for (const recipient of recipients) {
    try {
      await sendEmail({ ...options, to: recipient });
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({ email: recipient, error: String(error) });
    }
  }

  return results;
}

// Send bulk emails via Brevo API (for marketing)
export async function sendBulkBrevoEmails(
  recipients: string[],
  options: Omit<EmailOptions, "to">
): Promise<{ sent: number; failed: number; errors: any[] }> {
  const results = { sent: 0, failed: 0, errors: [] as any[] };

  for (const recipient of recipients) {
    try {
      await sendBrevoEmail({ ...options, to: recipient });
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({ email: recipient, error: String(error) });
    }
  }

  return results;
}

// Utility to strip HTML tags
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<style[^>]*>.*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .join("\n");
}
