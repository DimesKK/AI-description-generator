# AI Product Description Generator - API Documentation

## Overview

The AI Product Description Generator API provides a comprehensive suite of endpoints for automating the creation and management of product descriptions using OpenAI's GPT-4. The API integrates with Shopify stores and supports bulk operations, SEO optimization, and real-time analytics.

**Base URL:** `http://localhost:3001/api`

**Authentication:** Bearer Token (JWT) required for most endpoints

## Authentication

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "shopifyDomain": "your-store.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clp1234567890",
      "email": "user@example.com",
      "plan": "basic",
      "subscriptionStatus": "inactive"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here"
  }
}
```

### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer {refresh_token}
```

### Get User Profile
```http
GET /api/auth/profile
Authorization: Bearer {access_token}
```

## Products

### Get Products
Fetch products from connected Shopify store.

```http
GET /api/products?page=1&limit=20&status=active
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Product status filter (active, draft, archived)
- `search` (optional): Search by title or vendor
- `vendor` (optional): Filter by vendor
- `productType` (optional): Filter by product type

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_1234567890",
        "title": "Wireless Bluetooth Headphones",
        "vendor": "TechCorp",
        "productType": "Electronics",
        "tags": ["electronics", "audio", "bluetooth"],
        "images": ["https://cdn.shopify.com/image1.jpg"],
        "status": "active",
        "createdAt": "2025-01-01T00:00:00Z",
        "hasDescription": false
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 95,
      "itemsPerPage": 20
    }
  }
}
```

### Get Single Product
```http
GET /api/products/{productId}
Authorization: Bearer {access_token}
```

### Update Product
```http
PUT /api/products/{productId}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "Updated Product Title",
  "description": "Updated description...",
  "vendor": "New Vendor",
  "productType": "Electronics",
  "tags": ["electronics", "updated", "new"]
}
```

## Descriptions

### Generate Description
Create a single product description using AI.

```http
POST /api/descriptions/generate
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "productId": "prod_1234567890",
  "options": {
    "tone": "professional",
    "language": "en",
    "keywords": ["wireless", "bluetooth", "high-quality"],
    "wordCount": 150,
    "seoOptimization": true,
    "includeFeatures": true,
    "includeBenefits": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "description": {
      "id": "desc_1234567890",
      "productId": "prod_1234567890",
      "content": "Experience premium audio quality with our wireless Bluetooth headphones...",
      "wordCount": 156,
      "seoScore": 85,
      "keywords": ["wireless", "bluetooth", "audio", "headphones"],
      "tone": "professional",
      "language": "en",
      "aiModel": "gpt-4",
      "generationCost": 0.05,
      "status": "completed",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

### Bulk Generate Descriptions
Generate descriptions for multiple products at once.

```http
POST /api/descriptions/bulk-generate
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "productIds": [
    "prod_1234567890",
    "prod_0987654321",
    "prod_1122334455"
  ],
  "config": {
    "tone": "casual",
    "language": "en",
    "keywords": ["premium", "quality", "innovative"],
    "wordCount": 120,
    "seoOptimization": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890",
    "message": "Bulk generation started. Check job status for progress."
  }
}
```

### Optimize Existing Description
SEO optimize an existing product description.

```http
POST /api/descriptions/optimize
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "Current product description...",
  "productData": {
    "title": "Product Title",
    "productType": "Electronics",
    "keywords": ["existing", "keywords"]
  },
  "options": {
    "language": "en",
    "targetKeywords": ["new", "target", "keywords"],
    "seoScore": 90
  }
}
```

### Get Descriptions
```http
GET /api/descriptions?page=1&limit=20&sortBy=createdAt&sortOrder=desc
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page (max: 100)
- `sortBy` (optional): createdAt, updatedAt, seoScore, wordCount
- `sortOrder` (optional): asc, desc
- `productId` (optional): Filter by product ID
- `status` (optional): Filter by status (pending, completed, failed)

### Update Description
```http
PUT /api/descriptions/{descriptionId}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "content": "Updated description content...",
  "keywords": ["new", "keywords"],
  "tone": "friendly",
  "seoOptimization": true
}
```

## Jobs

### Get Job Status
Check the status of bulk generation jobs.

```http
GET /api/jobs/{jobId}
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job_1234567890",
      "type": "bulk_generation",
      "status": "processing",
      "totalProducts": 25,
      "processedProducts": 15,
      "successfulProducts": 14,
      "failedProducts": 1,
      "progress": 60,
      "startedAt": "2025-01-01T00:00:00Z",
      "estimatedCompletion": "2025-01-01T00:05:00Z",
      "results": [
        {
          "productId": "prod_1234567890",
          "status": "completed",
          "descriptionId": "desc_1234567890"
        }
      ]
    }
  }
}
```

### Cancel Job
```http
DELETE /api/jobs/{jobId}
Authorization: Bearer {access_token}
```

### Get User Jobs
```http
GET /api/jobs?page=1&limit=20&status=all
Authorization: Bearer {access_token}
```

## Analytics

### Dashboard Metrics
Get comprehensive dashboard analytics.

```http
GET /api/analytics/dashboard
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalDescriptions": 1250,
      "successfulGenerations": 1180,
      "failedGenerations": 70,
      "successRate": 94.4,
      "totalRevenue": 2847.50,
      "activeSubscriptions": 45
    },
    "usage": {
      "thisMonth": {
        "descriptionsGenerated": 325,
        "apiCalls": 380,
        "cost": 18.75
      },
      "lastMonth": {
        "descriptionsGenerated": 295,
        "apiCalls": 350,
        "cost": 16.20
      }
    },
    "growth": {
      "userGrowth": 12.5,
      "revenueGrowth": 15.8,
      "usageGrowth": 18.2
    }
  }
}
```

### Detailed Analytics
```http
GET /api/analytics/usage?startDate=2025-01-01&endDate=2025-01-31&granularity=day
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `granularity` (optional): hour, day, week, month (default: day)

### Revenue Analytics
```http
GET /api/analytics/revenue?period=monthly
Authorization: Bearer {access_token}
```

## Subscriptions

### Get Subscription Plans
```http
GET /api/subscriptions/plans
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "basic",
        "name": "Basic",
        "price": 29,
        "currency": "usd",
        "interval": "month",
        "features": {
          "products": 500,
          "descriptions": 1000,
          "languages": 1,
          "support": "email",
          "customTone": false,
          "seoOptimization": true,
          "bulkGeneration": false
        }
      },
      {
        "id": "pro",
        "name": "Pro",
        "price": 79,
        "currency": "usd",
        "interval": "month",
        "features": {
          "products": 2000,
          "descriptions": 5000,
          "languages": 5,
          "support": "priority",
          "customTone": true,
          "seoOptimization": true,
          "bulkGeneration": true
        }
      }
    ]
  }
}
```

### Create Subscription
```http
POST /api/subscriptions/create
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "plan": "pro",
  "paymentMethodId": "pm_1234567890",
  "trialDays": 14
}
```

### Update Subscription
```http
PUT /api/subscriptions/{subscriptionId}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "plan": "enterprise",
  "paymentMethodId": "pm_0987654321"
}
```

### Cancel Subscription
```http
DELETE /api/subscriptions/{subscriptionId}
Authorization: Bearer {access_token}
```

### Get Billing Portal URL
```http
GET /api/subscriptions/portal
Authorization: Bearer {access_token}
```

## Webhooks

### Shopify Webhook
Handle Shopify product updates and order events.

```http
POST /webhooks/shopify
Content-Type: application/json
X-Shopify-Topic: products/update
X-Shopify-Hmac-Sha256: {webhook_signature}

{
  "id": 1234567890,
  "title": "Product Title",
  "body_html": "<p>Product description</p>",
  "vendor": "Vendor Name",
  "product_type": "Category",
  "tags": "tag1,tag2,tag3",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### Stripe Webhook
Handle subscription and payment events.

```http
POST /webhooks/stripe
Content-Type: application/json
Stripe-Signature: {webhook_signature}

{
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_1234567890",
      "customer": "cus_1234567890",
      "status": "active",
      "current_period_start": 1704067200,
      "current_period_end": 1706745600,
      "plan": {
        "id": "price_1234567890",
        "amount": 7900,
        "currency": "usd"
      }
    }
  }
}
```

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-01T00:00:00Z",
  "path": "/api/endpoint",
  "method": "POST",
  "details": {
    "field": "specific_field",
    "message": "Field-specific error message"
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_ERROR`: Invalid or missing authentication
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND_ERROR`: Resource not found
- `RATE_LIMIT_ERROR`: Rate limit exceeded
- `EXTERNAL_SERVICE_ERROR`: Third-party service error
- `SUBSCRIPTION_REQUIRED`: Active subscription required

## Rate Limits

- **Authentication endpoints:** 10 requests per minute per IP
- **Generation endpoints:** 100 requests per hour per user
- **General API:** 1000 requests per hour per user
- **Webhook endpoints:** 10,000 requests per hour per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1640995200
```

## SDKs and Libraries

### JavaScript/Node.js
```bash
npm install ai-description-generator-sdk
```

```javascript
const { AIDescriptionGenerator } = require('ai-description-generator-sdk');

const client = new AIDescriptionGenerator({
  apiKey: 'your-api-key',
  baseURL: 'http://localhost:3001/api'
});

// Generate description
const description = await client.descriptions.generate({
  productId: 'prod_123',
  options: {
    tone: 'professional',
    keywords: ['wireless', 'bluetooth']
  }
});
```

### Python
```bash
pip install ai-description-generator-sdk
```

```python
from ai_description_generator import AIDescriptionGenerator

client = AIDescriptionGenerator(
    api_key='your-api-key',
    base_url='http://localhost:3001/api'
)

# Generate description
description = client.descriptions.generate(
    product_id='prod_123',
    options={
        'tone': 'professional',
        'keywords': ['wireless', 'bluetooth']
    }
)
```

## Support

- **Documentation:** https://docs.ai-descriptions.com
- **API Status:** https://status.ai-descriptions.com
- **Support Email:** api-support@ai-descriptions.com
- **Developer Portal:** https://developers.ai-descriptions.com

## Changelog

### v1.0.0 (2025-01-01)
- Initial API release
- Product description generation
- Bulk operations support
- Shopify integration
- Stripe subscription management
- Real-time analytics
- Webhook support
