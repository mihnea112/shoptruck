# Email Marketing Guide - ShopTruck

## Overview

The email marketing system allows admins to create, compose, and send promotional email campaigns with AI-generated content based on selected products. The system uses Google Gemini to generate professional HTML emails that include product information, images, and direct links to products.

## Features

### 1. **AI-Powered Email Composition**
- **Manual Mode**: Traditional email composition with generic AI help
- **Product-Based Mode**: Generate emails automatically featuring selected products
- Supports multiple tone options: Professional, Friendly, Urgent
- Creates both HTML and plain-text versions automatically

### 2. **Product Selection & Integration**
- Search products by name, brand, or SKU
- Select multiple products for inclusion in the email
- Products include:
  - Product image
  - Product name and brand
  - Pricing in RON (lei)
  - Direct product page links

### 3. **Branding Integration**
The system automatically incorporates ShopTruck branding:
- **Primary Color**: #feab1f (warm orange/amber)
- **Secondary Colors**: #b57712 (darker orange), white, light gray
- Professional layout with responsive design
- Header with ShopTruck branding
- Footer with contact and unsubscribe information

### 4. **Campaign Management**
- Create draft campaigns
- Preview HTML emails before sending
- Schedule campaigns for later sending
- Track delivery statistics (sent, failed, bounce counts)
- View campaign history and stats

## How to Use

### Accessing Email Marketing

1. Go to Admin Dashboard (`/admin`)
2. Navigate to **Marketing** → **Campanii Email** in the left sidebar
3. You'll see a list of existing campaigns

### Creating a New Campaign

#### Step 1: Start New Campaign
- Click "Campanie nouă" (New Campaign)
- Enter campaign name
- Enter email subject line

#### Step 2: Choose Generation Method

**Option A: Standard AI Composition**
1. Set the tone: Professional, Friendly, or Urgent
2. Enter key points to include
3. Click "Generează cu IA" (Generate with AI)
4. AI will create HTML and text versions

**Option B: Product-Based Generation** (Recommended)
1. Search for products by name, brand, or SKU
2. Select products from search results
3. Products appear in "Produse selectate" section
4. Set campaign tone
5. Enter key points/messaging
6. Click "Generează Email"
7. AI generates professional email featuring the selected products

#### Step 3: Preview & Edit
- Click "Preview HTML" to see how the email looks
- Edit HTML/Text directly if needed
- Review product links and formatting

#### Step 4: Save Campaign
- Click "Salvează" (Save)
- Campaign is saved as draft

#### Step 5: Send Campaign
- Click "Trimite acum" (Send Now)
- System will prompt: "Send campaign to X contacts?"
- Email is sent to all active subscribers

### Example: Creating a Product-Based Campaign

**Scenario**: You want to promote new car parts with 30% discount

1. **New Campaign**
   - Name: "Ofertă martie - piese auto"
   - Subject: "Piese auto 30% reducere!"

2. **Product Selection**
   - Search: "carburator"
   - Select: 3-4 relevant products
   - Add to "Produse selectate"

3. **AI Generation**
   - Tone: "Professional"
   - Key Points: "Reducere 30%, Livrare gratis pentru comenzi peste 100 RON, Garanție 2 ani, Stoc limitat"
   - Click "Generează Email"

4. **Review & Send**
   - Preview shows professional email with product images and prices
   - Each product has clickable link to product page
   - Click "Salvează" then "Trimite acum"

## Managing Contacts

### Adding Email Contacts
1. Go to **Marketing** → **Contacte Email**
2. Click "Import contacte" to bulk upload
3. Or manually add contacts one by one

### Contact List
- View all subscribers
- Mark as active/inactive
- Export contact list
- Manage unsubscribe requests

## Email Content

### What Gets Generated

The AI creates professional emails including:
- **Header**: ShopTruck branding and greeting
- **Product Section**: For each selected product:
  - Product image (if available)
  - Product name and brand
  - Price in RON
  - "View Product" button with direct link
- **Key Points**: Main benefits/offers
- **Call-to-Action**: Professional CTA button
- **Footer**: 
  - Contact information
  - Social links (if configured)
  - Unsubscribe link
  - Company details

### Branding Applied

All generated emails automatically include:
- Orange (#feab1f) accent colors
- Professional, clean design
- Responsive layout for mobile
- Inline CSS for email client compatibility
- ShopTruck logo and company info

## Technical Details

### Database Tables Used
- `campaign` - Email campaigns
- `contact` - Email subscribers
- `campaign_send` - Send logs and statistics

### API Endpoints

**Generate Product-Based Email:**
```
POST /api/admin/email/compose-ai-products
{
  "subject": "Campaign subject",
  "tone": "professional|friendly|urgent",
  "keyPoints": "Point 1, Point 2, Point 3",
  "products": [
    {
      "id": "uuid",
      "slug": "product-slug",
      "name": "Product Name",
      "price_gross": 299.99,
      "brand_name": "Brand Name",
      "primary_image_url": "https://..."
    }
  ]
}
```

**Generate Standard Email:**
```
POST /api/admin/email/compose-ai
{
  "subject": "Campaign subject",
  "tone": "professional|friendly|urgent",
  "keyPoints": "Key points"
}
```

### Environment Variables Required

```env
GOOGLE_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SITE_URL=https://shoptruck.ro  # Or localhost:3000 for dev
```

## Best Practices

1. **Product Selection**
   - Choose 3-6 products per campaign for best results
   - Select complementary products
   - Ensure products have images for better visuals

2. **Subject Lines**
   - Keep under 50 characters
   - Include benefit or offer
   - Example: "Piese auto 30% reducere!"

3. **Key Points**
   - List 3-4 key benefits
   - Use simple, clear language
   - Include promotions, guarantees, free shipping, etc.

4. **Tone Selection**
   - **Professional**: For B2B, promotions, announcements
   - **Friendly**: For seasonal, casual offers
   - **Urgent**: For limited-time offers, flash sales

5. **Testing**
   - Always preview before sending
   - Check product links work correctly
   - Test email rendering on mobile devices

## Troubleshooting

### AI Generation Fails
- Check GOOGLE_API_KEY is set
- Ensure Gemini API has sufficient quota
- Try reducing number of products
- Check internet connection

### Products Not Appearing in Email
- Verify product images exist
- Check product is marked as active
- Try regenerating the email

### Email Links Broken
- Verify NEXT_PUBLIC_SITE_URL is correct
- Check product slug is valid
- Test links in preview before sending

### Low Delivery Rate
- Check email addresses in contact list
- Monitor spam/bounce complaints
- Ensure unsubscribe links work
- Send from verified email address

## Support & Maintenance

For issues or questions:
1. Check campaign history for patterns
2. Review API logs for errors
3. Verify all environment variables are set
4. Test with sample contact first before bulk send

## Future Enhancements

Possible improvements to consider:
- A/B testing different subject lines
- Scheduled send times optimization
- Advanced segmentation by customer type
- Template library for reuse
- Performance analytics dashboard
