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
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Initialize transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  // Check if Gmail configuration is provided
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailAppPassword) {
    // Use Gmail SMTP
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });
    console.log("[Email] Using Gmail SMTP configuration");
    return transporter;
  }

  // Fall back to custom SMTP configuration
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpTls = process.env.SMTP_TLS !== "false";

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error(
      "SMTP configuration incomplete. Provide either GMAIL_USER + GMAIL_APP_PASSWORD or SMTP_HOST + SMTP_USER + SMTP_PASSWORD in .env"
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
  console.log("[Email] Using custom SMTP configuration");

  return transporter;
}

// Send email
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = getTransporter();

    // Determine sender email based on configuration
    const gmailUser = process.env.GMAIL_USER;
    const fromEmail = gmailUser || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
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

// Send bulk emails
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
