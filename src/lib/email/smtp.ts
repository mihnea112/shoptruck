import nodemailer from "nodemailer";

// Create a reusable transporter instance with connection pooling
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "ShopTruck <info@shoptruck.ro>";

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP configuration incomplete. Check SMTP_HOST, SMTP_USER, SMTP_PASS."
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    pool: {
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    },
  } as Parameters<typeof nodemailer.createTransport>[0]);

  return transporter;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Send an email via SMTP
 * @param params Email parameters (to, subject, html, text)
 * @returns Result with success status and optional error message
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || "ShopTruck <info@shoptruck.ro>";

    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error("[SMTP Error]", error);
    return {
      success: false,
      error: error?.message || "Eroare SMTP necunoscută.",
    };
  }
}

/**
 * Verify SMTP connection (useful for testing)
 * @returns true if connection successful
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error("[SMTP Verify Error]", error);
    return false;
  }
}
