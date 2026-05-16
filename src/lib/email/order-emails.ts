import { sendEmail } from "./sender";
import { orderStatusTemplate } from "./templates";
import { Pool } from "pg";

export async function sendOrderStatusEmail(
  pool: Pool,
  orderId: string,
  newStatus: "processing" | "shipped" | "delivered" | "cancelled"
) {
  try {
    // Fetch order and account details
    const result = await pool.query(
      `
      SELECT
        o.id,
        o.status,
        a.display_name,
        a.email,
        a.phone
      FROM public."order" o
      LEFT JOIN public.account a ON a.id = o.account_id
      WHERE o.id = $1
      LIMIT 1
    `,
      [orderId]
    );

    const order = result.rows[0];
    if (!order || !order.email) {
      console.log(
        `[Order Email] Skipped: Order ${orderId} has no email address`
      );
      return;
    }

    // Map database status to template status
    const statusMap: Record<string, "processing" | "shipped" | "delivered" | "cancelled"> = {
      DRAFT: "processing",
      RESERVED: "processing",
      PROCESSING: "processing",
      SHIPPED: "shipped",
      DELIVERED: "delivered",
      CANCELLED: "cancelled",
    };

    const templateStatus = statusMap[newStatus] || newStatus;

    // Create email template
    const emailTemplate = orderStatusTemplate({
      orderNumber: order.id,
      customerName: order.display_name,
      status: templateStatus,
      trackingUrl: `https://shoptruck.ro/account`,
    });

    // Send email
    await sendEmail({
      to: order.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(
      `[Order Email] Sent: Order ${orderId} status update to ${order.email}`
    );
  } catch (err) {
    console.error(`[Order Email] Failed to send email for order ${orderId}:`, err);
    // Don't throw - we don't want email failures to break the order update
  }
}
