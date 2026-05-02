# Email System Setup Checklist

## ✅ Implementation Status

### Core Email Infrastructure
- [x] Email sending module (`/src/lib/email/sender.ts`)
  - SMTP transporter configuration
  - Single email sending function
  - Bulk email sending function
  - Error logging and handling

- [x] Email templates (`/src/lib/email/templates.ts`)
  - Order confirmation template
  - Order status update template
  - ShopTruck branding (colors, header, footer)
  - HTML and plain-text versions

- [x] Campaign utilities (`/src/lib/email/campaign-utils.ts`)
  - Unsubscribe link generation
  - HTML injection functions
  - HTML to plain-text conversion

### Admin Interface
- [x] Marketing menu item in admin navigation
  - "Campanii Email" (campaigns)
  - "Contacte Email" (contacts)

- [x] Campaign manager integration
  - Campaign editor with AI composition
  - Product search and selection
  - Tone selection
  - HTML preview

- [x] Campaign sending endpoint
  - Validates admin access
  - Sends to all active contacts
  - Personalizes unsubscribe links
  - Tracks sent/failed counts
  - Updates campaign status

### Dependencies
- [x] `nodemailer` - SMTP email sending
- [x] `@google/generative-ai` - AI email generation
- [x] `@types/nodemailer` - TypeScript types

### Configuration
- [x] `.env` file with SMTP settings
- [x] `.env.example` with detailed documentation
- [x] Support for multiple email providers

---

## 🔧 Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Email Provider

Choose your email provider and add credentials to `.env`:

**Gmail:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_TLS=true
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=ShopTruck
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-api-key
SMTP_TLS=true
SMTP_FROM_EMAIL=your-email@sendgrid.com
SMTP_FROM_NAME=ShopTruck
```

**Brevo:**
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-email
SMTP_PASSWORD=your-smtp-password
SMTP_TLS=true
SMTP_FROM_EMAIL=your-email
SMTP_FROM_NAME=ShopTruck
```

### 3. Verify Application URL
```env
NEXT_PUBLIC_APP_URL=https://shoptruck.ro  # Production
# or
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Development
```

### 4. Test Email Sending
```bash
# Create a test campaign and send to yourself
# Or use this in Node.js:

const { sendEmail } = require('./src/lib/email/sender');

await sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<h1>Hello!</h1>',
  text: 'Hello!'
});
```

### 5. Enable Transactional Emails (Optional)

When creating orders, send confirmation emails:

```typescript
import { sendEmail } from '@/lib/email/sender';
import { orderConfirmationTemplate } from '@/lib/email/templates';

// In your order creation endpoint
const template = orderConfirmationTemplate({
  orderNumber: order.id,
  customerName: customer.name,
  orderDate: new Date().toISOString(),
  items: order.items,
  subtotal: order.subtotal,
  tax: order.tax,
  total: order.total
});

await sendEmail({
  to: customer.email,
  subject: template.subject,
  html: template.html,
  text: template.text
});
```

---

## 📊 Quick Test

### Test Campaign Sending
1. Go to `/admin/email/campaigns`
2. Create a new campaign with subject and content
3. Click "Send Campaign"
4. Check your email inbox
5. Verify unsubscribe link works

### Test Product Email Generation
1. Go to `/admin/email/campaigns`
2. Open a campaign editor
3. Scroll to "AI Email Generator"
4. Search for a product and select it
5. Choose tone and click "Generate Email with Products"
6. Verify generated HTML looks correct

---

## 🚀 What's Ready to Use

### ✅ Implemented Features
- Marketing email campaigns with AI generation
- Product recommendations in emails
- SMTP sending to any provider
- Campaign analytics (sent/failed counts)
- Unsubscribe link generation
- Order confirmation templates
- Order status update templates
- Email contact management (existing)

### 🔄 To Implement (Optional)

#### 1. Send Order Confirmation Emails
**Location**: Where orders are created
```typescript
const template = orderConfirmationTemplate({...});
await sendEmail({...});
```

#### 2. Send Order Status Updates
**Location**: Where order status changes
```typescript
const template = orderStatusTemplate({...});
await sendEmail({...});
```

#### 3. Email Verification on Signup
**Location**: User registration endpoint
```typescript
const template = { subject, html, text }; // Create template
await sendEmail({...});
```

#### 4. Password Reset Email
**Location**: Password reset flow
```typescript
// Generate reset link
await sendEmail({...});
```

---

## 📧 Testing Email Providers

### Gmail Setup Test
1. Create App Password: https://myaccount.google.com/apppasswords
2. Use 16-character password as SMTP_PASSWORD
3. Send test email to confirm it works

### SendGrid Test
1. Create API key: https://app.sendgrid.com/settings/api_keys
2. Use `apikey` as SMTP_USER
3. Use API key as SMTP_PASSWORD
4. Verify in SendGrid dashboard

### Brevo Test
1. Get SMTP credentials: https://app.brevo.com/settings/account/smtp
2. Test connection
3. Send test email

---

## 🐛 Troubleshooting

### Problem: "SMTP configuration incomplete"
**Solution**: Ensure these env vars are set:
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASSWORD

### Problem: "Email send failed"
**Check**:
1. SMTP credentials are correct
2. Email provider supports your application
3. Firewall allows SMTP connections
4. API key/password hasn't expired

### Problem: "Campaign not sending"
**Check**:
1. Campaign status is "draft"
2. Campaign has HTML content
3. Active email contacts exist
4. SMTP configuration is valid

### Problem: "Unsubscribe links broken"
**Check**:
1. `NEXT_PUBLIC_APP_URL` is set correctly
2. Unsubscribe endpoint exists at `/api/public/unsubscribe`
3. Contact IDs are valid

---

## 📚 Files Overview

| File | Purpose |
|------|---------|
| `/src/lib/email/sender.ts` | SMTP configuration and sending |
| `/src/lib/email/templates.ts` | HTML email templates |
| `/src/lib/email/campaign-utils.ts` | Campaign helper functions |
| `/.env` | SMTP credentials and config |
| `/.env.example` | Configuration documentation |
| `/package.json` | Project dependencies |
| `/EMAIL_SYSTEM_GUIDE.md` | Detailed technical guide |
| `/SETUP_CHECKLIST.md` | This file |

---

## 🎯 Next Steps

1. **Complete Setup**:
   - [ ] Install dependencies: `npm install`
   - [ ] Configure SMTP in `.env`
   - [ ] Test campaign sending

2. **Integrate with Orders**:
   - [ ] Implement order creation endpoint
   - [ ] Send order confirmation email
   - [ ] Send order status updates

3. **Enhance Marketing**:
   - [ ] Create marketing campaigns in admin
   - [ ] Use AI to generate email content
   - [ ] Send campaigns to contact list

4. **Monitor & Improve**:
   - [ ] Check campaign statistics
   - [ ] Review email delivery rates
   - [ ] Optimize email content

---

## 💡 Pro Tips

1. **Test First**: Send test emails to yourself before sending to customers
2. **Check Spam**: Monitor spam folder during testing
3. **Use Plain Text**: Always include plain-text version for accessibility
4. **Unsubscribe Links**: Required in most jurisdictions (CAN-SPAM, GDPR)
5. **Batch Size**: For 1000+ emails, consider implementing a queue system
6. **Error Handling**: Always wrap email sends in try-catch blocks
7. **Logging**: Log all email sends for audit trails

---

## 📞 Support Resources

- **Nodemailer Docs**: https://nodemailer.com/
- **Gmail Setup**: https://nodemailer.com/smtp/gmail/
- **SMTP Troubleshooting**: https://nodemailer.com/smtp/
- **Google Gemini API**: https://ai.google.dev/
