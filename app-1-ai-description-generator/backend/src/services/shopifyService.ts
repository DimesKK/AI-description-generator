import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import { config } from '../config';
import { logger } from '../config/logger';
import { ExternalServiceError } from '../middleware/errorHandler';

export interface ShopifyProduct {
  id: string;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  images?: Array<{
    id: string;
    src: string;
    alt?: string;
  }>;
  variants?: Array<{
    id: string;
    price: string;
    sku?: string;
    inventory_quantity: number;
  }>;
  created_at: string;
  updated_at: string;
  status: string;
  published_at?: string;
}

export interface ShopifyStore {
  id: string;
  name: string;
  email?: string;
  currency: string;
  timezone: string;
  domain: string;
  myshopify_domain: string;
}

export interface ShopifyWebhook {
  id: string;
  topic: string;
  address: string;
  format: string;
  metafield_namespaces?: string[];
}

class ShopifyService {
  private api: any;

  constructor() {
    this.api = shopifyApi({
      apiKey: config.shopify.apiKey,
      apiSecretKey: config.shopify.apiSecret,
      scopes: config.shopify.scopes,
      apiVersion: config.shopify.apiVersion as ApiVersion,
      hostName: process.env.SHOPIFY_HOST_NAME || 'localhost',
      isEmbeddedApp: false,
      logger: {
        level: 'info',
        httpRequests: false,
        timestamps: false
      }
    });
  }

  /**
   * Get authenticated Shopify session for a store
   */
  private async getSession(shopDomain: string, accessToken: string) {
    try {
      return {
        shop: shopDomain,
        accessToken,
        isOnline: true,
        state: 'authenticated',
        id: `offline_${shopDomain}`
      };
    } catch (error) {
      logger.error('Failed to create Shopify session:', error);
      throw new ExternalServiceError('Shopify', 'Failed to create session', error);
    }
  }

  /**
   * Fetch all products from a Shopify store
   */
  async getProducts(
    shopDomain: string,
    accessToken: string,
    options: {
      limit?: number;
      sinceId?: string;
      title?: string;
      vendor?: string;
      productType?: string;
      status?: string;
      publishedStatus?: string;
    } = {}
  ): Promise<ShopifyProduct[]> {
    try {
      const session = await this.getSession(shopDomain, accessToken);
      const client = new this.api.clients.Rest({ session });

      const params: any = {
        limit: options.limit || 250,
      };

      // Add filters if provided
      if (options.sinceId) params.since_id = options.sinceId;
      if (options.title) params.title = options.title;
      if (options.vendor) params.vendor = options.vendor;
      if (options.productType) params.product_type = options.productType;
      if (options.status) params.status = options.status;
      if (options.publishedStatus) params.published_status = options.publishedStatus;

      const response = await client.get({
        path: 'products',
        query: params,
      });

      return response.body.products || [];
    } catch (error) {
      logger.error('Failed to fetch Shopify products:', error);
      throw new ExternalServiceError('Shopify', 'Failed to fetch products', { 
        shopDomain, 
        error: error.message 
      });
    }
  }

  /**
   * Fetch a specific product by ID
   */
  async getProduct(
    shopDomain: string,
    accessToken: string,
    productId: string
  ): Promise<ShopifyProduct | null> {
    try {
      const session = await this.getSession(shopDomain, accessToken);
      const client = new this.api.clients.Rest({ session });

      const response = await client.get({
        path: `products/${productId}`,
      });

      return response.body.product || null;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to fetch Shopify product:', error);
      throw new ExternalServiceError('Shopify', 'Failed to fetch product', { 
        productId, 
        error: error.message 
      });
    }
  }

  /**
   * Update a product's description
   */
  async updateProductDescription(
    shopDomain: string,
    accessToken: string,
    productId: string,
    description: string
  ): Promise<ShopifyProduct> {
    try {
      const session = await this.getSession(shopDomain, accessToken);
      const client = new this.api.clients.Rest({ session });

      const response = await client.put({
        path: `products/${productId}`,
        data: {
          product: {
            id: productId,
            body_html: description
          }
        }
      });

      logger.info(`Updated product description for product ${productId}`);
      return response.body.product;
    } catch (error) {
      logger.error('Failed to update Shopify product description:', error);
      throw new ExternalServiceError('Shopify', 'Failed to update product', { 
        productId, 
        error: error.message 
      });
    }
  }

  /**
   * Bulk update multiple product descriptions
   */
  async bulkUpdateProductDescriptions(
    shopDomain: string,
    accessToken: string,
    updates: Array<{
      productId: string;
      description: string;
    }>
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process updates in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const promises = batch.map(async (update) => {
        try {
          await this.updateProductDescription(
            shopDomain,
            accessToken,
            update.productId,
            update.description
          );
          results.success++;
          return { success: true };
        } catch (error) {
          results.failed++;
          results.errors.push({
            productId: update.productId,
            error: error.message
          });
          logger.error(`Failed to update product ${update.productId}:`, error);
          return { success: false, error };
        }
      });

      await Promise.all(promises);

      // Add delay between batches to respect rate limits
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get store information
   */
  async getStoreInfo(shopDomain: string, accessToken: string): Promise<ShopifyStore | null> {
    try {
      const session = await this.getSession(shopDomain, accessToken);
      const client = new this.api.clients.Rest({ session });

      const response = await client.get({
        path: 'shop',
      });

      return response.body.shop || null;
    } catch (error) {
      logger.error('Failed to fetch Shopify store info:', error);
      throw new ExternalServiceError('Shopify', 'Failed to fetch store info', { 
        shopDomain, 
        error: error.message 
      });
    }
  }

  /**
   * Create a webhook for product updates
   */
  async createWebhook(
    shopDomain: string,
    accessToken: string,
    webhook: {
      topic: string;
      address: string;
      format: string;
    }
  ): Promise<ShopifyWebhook> {
    try {
      const session = await this.getSession(shopDomain, accessToken);
      const client = new this.api.clients.Rest({ session });

      const response = await client.post({
        path: 'webhooks',
        data: {
          webhook: {
            topic: webhook.topic,
            address: webhook.address,
            format: webhook.format
          }
        }
      });

      return response.body.webhook;
    } catch (error) {
      logger.error('Failed to create Shopify webhook:', error);
      throw new ExternalServiceError('Shopify', 'Failed to create webhook', { 
        topic: webhook.topic, 
        error: error.message 
      });
    }
  }

  /**
   * Get all webhooks for a store
   */
  async getWebhooks(
    shopDomain: string,
    accessToken: string
  ): Promise<ShopifyWebhook[]> {
    try {
      const session = await this.getSession(shopDomain, accessToken);
      const client = new this.api.clients.Rest({ session });

      const response = await client.get({
        path: 'webhooks',
      });

      return response.body.webhooks || [];
    } catch (error) {
      logger.error('Failed to fetch Shopify webhooks:', error);
      throw new ExternalServiceError('Shopify', 'Failed to fetch webhooks', { 
        shopDomain, 
        error: error.message 
      });
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(
    shopDomain: string,
    accessToken: string,
    webhookId: string
  ): Promise<void> {
    try {
      const session = await this.getSession(shopDomain, accessToken);
      const client = new this.api.clients.Rest({ session });

      await client.delete({
        path: `webhooks/${webhookId}`,
      });

      logger.info(`Deleted webhook ${webhookId}`);
    } catch (error) {
      logger.error('Failed to delete Shopify webhook:', error);
      throw new ExternalServiceError('Shopify', 'Failed to delete webhook', { 
        webhookId, 
        error: error.message 
      });
    }
  }

  /**
   * Verify webhook HMAC signature
   */
  verifyWebhook(
    rawBody: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody, 'utf8');
      const hash = hmac.digest('base64');
      
      return hash === signature;
    } catch (error) {
      logger.error('Failed to verify webhook signature:', error);
      return false;
    }
  }

  /**
   * Get API rate limits
   */
  getRateLimitInfo() {
    return {
      callsPerSecond: 2,
      callsPerMinute: 40,
      callsPerHour: 4500,
      callsPerDay: 100000
    };
  }
}

export const shopifyService = new ShopifyService();
export default shopifyService;
