# ShopTruck Email System - Implementation Guide

## Overview

The email system has been fully implemented with support for:
- **Email Marketing**: AI-powered campaign generation with Google Gemini
- **Transactional Emails**: Order confirmations and status updates
- **SMTP Sending**: Flexible configuration for any email provider
- **Campaign Management**: Admin panel for creating, designing, and sending email campaigns
- **Product Integration**: Link products directly in marketing emails

---

## Components Implemented

### 1. Email Sending Infrastructure

**File**: `/src/lib/email/sender.ts`

Core functionality for sending emails via SMTP:

```typescript
// Send a single email
await sendEmail({
  to: 'customer@example.com',
  subject: 'Order Confirmation',
  html: '<h1>Thank you for your order!</h1>',
  text: 'Thank you for your order!',
  cc?: 'admin@example.com',
  bcc?: 'archive@example.com',
  replyTo?: 'support@example.com'
});

// Send bulk emails to multiple recipients
const results = await sendBulkEmails(
  ['customer1@example.com', 'customer2@example.com'],
  {
    subject: 'Summer Sale - 50% Off',
    html: campaignHtml,
    text: campaignText
  }
);
// Returns: { sent: 2, failed: 0, errors: [] }
```

**Features**:
- SMTP transporter initialization from environment variables
- Support for CC, BCC, and Reply-To fields
- Automatic HTML-to-text conversion
- Error logging and tracking
- Bulk sending with individual error handling

---

### 2. Email Templates

**File**: `/src/lib/email/templates.ts`

Professional HTML email templates with ShopTruck branding:

#### Order Confirmation Template
```typescript
const template = orderConfirmationTemplate({
  orderNumber: '#ORD-001',
  customerName: 'John Doe',
  orderDate: '2024-05-02',
  items: [
    { name: 'Premium Engine Oil', quantity: 2, price: 50, slug: 'premium-oil' }
  ],
  subtotal: 100,
  tax: 20,
  total: 120,
  trackingUrl: 'https://tracking.example.com'
});

// Returns: { subject, html, text }
```

**Features**:
- ShopTruck branded header and footer
- Itemized order table with product links
- Subtotal, tax, and total calculations
- Optional tracking URL
- Responsive design
- Plain-text fallback

#### Order Status Update Template
```typescript
const template = orderStatusTemplate({
  orderNumber: '#ORD-001',
  customerName: 'John Doe',
  status: 'shipped', // 'processing' | 'shipped' | 'delivered' | 'cancelled'
  trackingNumber: 'TRK123456',
  trackingUrl: 'https://tracking.example.com',
  notes: 'Expected delivery: May 5th'
});

// Returns: { subject, html, text }
```

**Features**:
- Status-specific icons and messages
- Tracking information display
- Optional notes field
- Consistent branding

---

### 3. Campaign Utility Functions

**File**: `/src/lib/email/campaign-utils.ts`

Helper functions for campaign email generation:

```typescript
// Generate unsubscribe URL for a contact
const unsubUrl = generateUnsubscribeUrl(contactId, 'https://shoptruck.ro');

// Inject unsubscribe footer into HTML
const htmlWithFooter = injectUnsubscribeLink(html, contactId, appUrl);

// Convert HTML to plain text
const plainText = stripHtmlToText(htmlWithFooter);
```

**Features**:
- Base64-encoded token generation
- Unsubscribe link injection
- HTML entity decoding
- Responsive plain-text conversion

---

### 4. Email Marketing Admin Panel

**File**: `/src/app/admin/email/campaigns/`

Complete admin interface for email campaigns:

#### Campaign Editor (`[id]/ui.tsx`)
- Create and edit campaign details
- AI-powered email composition with product selection
- Product search and selection
- HTML body editor
- Campaign preview
- Send campaign to all active contacts

#### Product Generator Component (`product-generator.tsx`)
- Real-time product search
- Product selection with visual feedback
- Tone selection (Professional, Friendly, Urgent)
- AI email generation using Google Gemini
- Subject and key points input
- One-click HTML generation

---

### 5. Campaign Sending Endpoint

**File**: `/src/app/api/admin/email/campaigns/[id]/send/route.ts`

**Functionality**:
1. Validates user is admin
2. Retrieves campaign with HTML body
3. Fetches all active email contacts
4. Injects personalized unsubscribe links
5. Sends emails via SMTP
6. Updates `campaign_send` records with status
7. Tracks sent/failed counts

**Process**:
```
1. Admin clicks "Send Campaign" in UI
2. POST /api/admin/email/campaigns/[id]/send
3. For each contact:
   - Generate personalized HTML with unsubscribe link
   - Send via sendEmail()
   - Log success/failure to database
4. Update campaign status to "sent"
5. Return statistics (sent count, failed count)
```

**Error Handling**:
- Individual email failures don't stop the batch
- Each failure is logged with error message
- Campaign completes even if some emails fail
- Failed count is tracked

---

## Configuration

### Installation

First, install the required dependencies:

```bash
npm install nodemailer @google/generative-ai
```

These are already added to `package.json`.

### Environment Variables

Configure your `.env` file with SMTP credentials and API keys:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TLS=true

# Email Display
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=ShopTruck

# Google Gemini API (for AI email generation)
GOOGLE_API_KEY=your-api-key

# Application URL
NEXT_PUBLIC_APP_URL=https://shoptruck.ro
```

### Supported Email Providers

#### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=16-char-app-password  # Create at myaccount.google.com/apppasswords
SMTP_TLS=true
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxx...  # Your SendGrid API key
SMTP_TLS=true
```

#### Brevo (Sendinblue)
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-email
SMTP_PASSWORD=your-brevo-smtp-password
SMTP_TLS=true
```

#### Custom SMTP
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587  # or 25, 465
SMTP_USER=your-username
SMTP_PASSWORD=your-password
SMTP_TLS=true  # false for port 25
```

---

## Usage

### 1. Sending Transactional Emails

When an order is created, send a confirmation email:

```typescript
import { sendEmail } from '@/lib/email/sender';
import { orderConfirmationTemplate } from '@/lib/email/templates';

// In your order creation endpoint:
const template = orderConfirmationTemplate({
  orderNumber: order.id,
  customerName: order.customer_name,
  orderDate: new Date().toISOString(),
  items: order.items,
  subtotal: order.subtotal,
  tax: order.tax,
  total: order.total,
  trackingUrl: `https://shoptruck.ro/order/${order.id}/track`
});

await sendEmail({
  to: order.customer_email,
  subject: template.subject,
  html: template.html,
  text: template.text
});
```

### 2. Sending Order Status Updates

When order status changes:

```typescript
import { sendEmail } from '@/lib/email/sender';
import { orderStatusTemplate } from '@/lib/email/templates';

const template = orderStatusTemplate({
  orderNumber: order.id,
  customerName: order.customer_name,
  status: 'shipped',
  trackingNumber: 'TRK123456789',
  trackingUrl: 'https://tracking-provider.com/TRK123456789',
  notes: 'Your order will arrive by May 5th'
});

await sendEmail({
  to: order.customer_email,
  subject: template.subject,
  html: template.html,
  text: template.text
});
```

### 3. Creating Marketing Campaigns

#### Step 1: Admin creates campaign
- Navigate to `/admin/email/campaigns`
- Click "Create Campaign"
- Fill in campaign name, subject, and initial content

#### Step 2: Generate email with AI
- In the campaign editor, scroll to "AI Email Generator"
- Search and select products
- Choose tone (Professional, Friendly, Urgent)
- Add key points
- Click "Generate Email with Products"

#### Step 3: Review and refine
- The AI generates HTML email body
- Review the content
- Edit HTML if needed
- Add call-to-action buttons

#### Step 4: Send to contacts
- Click "Send Campaign"
- System sends to all active email contacts
- Each email gets personalized unsubscribe link
- View stats on campaign page

---

## Database Schema

### campaign_send Table
Tracks individual email sends for analytics:

```sql
campaign_send (
  id: UUID
  campaign_id: UUID (references campaign)
  contact_id: UUID (references email_contact)
  status: 'sent' | 'failed' | 'pending'
  sent_at: TIMESTAMP
  error_message: TEXT
  created_at: TIMESTAMP
  UNIQUE(campaign_id, contact_id)
)
```

### campaign Table (updated)
```sql
campaign (
  ...
  sent_count: INT (total sent successfully)
  failed_count: INT (total failed)
  total_count: INT (total attempted)
  html_body: TEXT (email HTML content)
  ...
)
```

---

## API Endpoints

### Send Campaign
```
POST /api/admin/email/campaigns/[id]/send

Response: {
  ok: true,
  campaign: {
    id: string,
    name: string,
    subject: string,
    status: 'sent',
    sent_count: number,
    failed_count: number,
    total_count: number
  }
}
```

### Generate Email with AI
```
POST /api/admin/email/compose-ai-products

Body: {
  products: Array<{
    slug: string,
    name: string,
    price: number,
    images: string[]
  }>,
  subject: string,
  keyPoints: string[],
  tone: 'Professional' | 'Friendly' | 'Urgent'
}

Response: {
  html: string,
  text: string
}
```

---

## Features & Capabilities

### ✅ Implemented
- [x] SMTP email sending via nodemailer
- [x] Multiple email provider support
- [x] Order confirmation email templates
- [x] Order status update templates
- [x] AI-powered email generation with Google Gemini
- [x] Product-based email recommendations
- [x] Marketing campaign management
- [x] Bulk email sending
- [x] Per-contact unsubscribe links
- [x] HTML to plain-text conversion
- [x] Campaign analytics (sent/failed counts)
- [x] Admin panel UI for campaigns
- [x] Product search in email composer
- [x] Email branding with company colors

### 🔄 Ready to Integrate
- [ ] Order creation → Send confirmation email
- [ ] Order status change → Send status email
- [ ] User signup → Send welcome email
- [ ] Cart abandonment → Send reminder email
- [ ] Customer review → Send thank you email

### 🚀 Future Enhancements
- Email open tracking
- Click tracking on email links
- A/B testing for campaigns
- Schedule campaign sending
- Email template builder UI
- Recipient segmentation
- Custom email workflows

---

## Troubleshooting

### Emails not sending
1. Check SMTP credentials in `.env`
2. Verify SMTP server is accessible
3. Check firewall/port availability
4. Review error logs in console

### Email appears blank
1. Verify HTML content is not empty
2. Check HTML validity
3. Test plain-text version

### Unsubscribe links not working
1. Verify `NEXT_PUBLIC_APP_URL` is set correctly
2. Check unsubscribe endpoint exists
3. Verify contact ID is valid

### Google Gemini errors
1. Verify `GOOGLE_API_KEY` is set
2. Check API key is valid and has Generative AI enabled
3. Verify monthly quota not exceeded

---

## Security Considerations

1. **API Keys**: Keep `GOOGLE_API_KEY` and `SMTP_PASSWORD` secure in `.env`
2. **SMTP**: Use TLS/SSL for secure connections
3. **Admin Access**: Campaign sending requires admin role
4. **Unsubscribe**: Always include unsubscribe links (requirement in many jurisdictions)
5. **Rate Limiting**: Consider implementing rate limits on bulk sending
6. **Validation**: Validate email addresses before sending

---

## Performance Notes

- Bulk emails are sent sequentially to avoid overwhelming SMTP server
- Each failed email doesn't stop the batch
- Database operations are wrapped in error handling
- Consider implementing queue system for very large campaigns (1000+)

---

## Files Created/Modified

### New Files
- `/src/lib/email/sender.ts` - SMTP email sending
- `/src/lib/email/templates.ts` - Email templates
- `/src/lib/email/campaign-utils.ts` - Campaign utilities
- `/.env.example` - Environment variable documentation
- `/EMAIL_SYSTEM_GUIDE.md` - This guide

### Modified Files
- `/package.json` - Added nodemailer and @google/generative-ai
- `/.env` - Added SMTP configuration
- `/src/app/api/admin/email/campaigns/[id]/send/route.ts` - Integrated SMTP sending

---

## Next Steps

1. **Install dependencies**: `npm install`
2. **Configure SMTP**: Add SMTP credentials to `.env`
3. **Test email sending**: Send test campaign to yourself
4. **Integrate with orders**: Wire up email sending in order creation
5. **Monitor campaigns**: Check campaign stats in admin panel

---

## Support & Documentation

- Google Generative AI: https://ai.google.dev/
- Nodemailer: https://nodemailer.com/
- SMTP Setup Guides: https://nodemailer.com/smtp/
