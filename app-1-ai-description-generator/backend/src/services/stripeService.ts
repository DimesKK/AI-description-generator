import Stripe from 'stripe';
import { config } from '../config';
import { logger } from '../config/logger';
import { ExternalServiceError } from '../middleware/errorHandler';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: {
    products: number;
    descriptions: number;
    languages: number;
    support: string;
    customTone: boolean;
    seoOptimization: boolean;
    bulkGeneration: boolean;
    customTraining?: boolean;
    apiAccess?: boolean;
  };
}

export interface SubscriptionData {
  plan: string;
  customerId?: string;
  paymentMethodId?: string;
  trialDays?: number;
  coupon?: string;
  metadata?: Record<string, string>;
}

export interface CustomerData {
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  metadata?: Record<string, string>;
}

class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!config.stripe.secretKey) {
      throw new Error('Stripe secret key is required');
    }

    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
      appInfo: {
        name: 'AI Description Generator',
        version: '1.0.0',
        url: 'https://ai-descriptions.com'
      }
    });
  }

  /**
   * Create a customer in Stripe
   */
  async createCustomer(customerData: CustomerData): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        metadata: customerData.metadata || {}
      });

      logger.info('Created Stripe customer', {
        customerId: customer.id,
        email: customerData.email
      });

      return customer;
    } catch (error: any) {
      logger.error('Failed to create Stripe customer:', error);
      throw new ExternalServiceError('Stripe', 'Failed to create customer', error);
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer | null> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        return null;
      }

      return customer as Stripe.Customer;
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        return null;
      }
      logger.error('Failed to get Stripe customer:', error);
      throw new ExternalServiceError('Stripe', 'Failed to get customer', error);
    }
  }

  /**
   * Update customer information
   */
  async updateCustomer(
    customerId: string,
    updates: Partial<CustomerData>
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        email: updates.email,
        name: updates.name,
        phone: updates.phone,
        address: updates.address,
        metadata: updates.metadata || {}
      });

      logger.info('Updated Stripe customer', {
        customerId,
        email: updates.email
      });

      return customer;
    } catch (error: any) {
      logger.error('Failed to update Stripe customer:', error);
      throw new ExternalServiceError('Stripe', 'Failed to update customer', error);
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(
    customerId: string,
    subscriptionData: SubscriptionData
  ): Promise<Stripe.Subscription> {
    try {
      // Get the price ID for the plan
      const priceId = await this.getPriceId(subscriptionData.plan);
      
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: subscriptionData.metadata || {}
      };

      // Add trial period if specified
      if (subscriptionData.trialDays) {
        subscriptionParams.trial_period_days = subscriptionData.trialDays;
      }

      // Apply coupon if provided
      if (subscriptionData.coupon) {
        subscriptionParams.coupon = subscriptionData.coupon;
      }

      // Attach payment method if provided
      if (subscriptionData.paymentMethodId) {
        await this.attachPaymentMethod(
          subscriptionData.paymentMethodId,
          customerId
        );
        
        subscriptionParams.default_payment_method = subscriptionData.paymentMethodId;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      logger.info('Created Stripe subscription', {
        subscriptionId: subscription.id,
        customerId,
        plan: subscriptionData.plan
      });

      return subscription;
    } catch (error: any) {
      logger.error('Failed to create Stripe subscription:', error);
      throw new ExternalServiceError('Stripe', 'Failed to create subscription', error);
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: {
      plan?: string;
      paymentMethodId?: string;
      coupon?: string;
      trialDays?: number;
    }
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      const updateParams: Stripe.SubscriptionUpdateParams = {};

      // Update plan if changed
      if (updates.plan && updates.plan !== subscription.items.data[0].price.id) {
        const newPriceId = await this.getPriceId(updates.plan);
        updateParams.items = [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          }
        ];
      }

      // Update payment method
      if (updates.paymentMethodId) {
        await this.attachPaymentMethod(updates.paymentMethodId, subscription.customer as string);
        updateParams.default_payment_method = updates.paymentMethodId;
      }

      // Update coupon
      if (updates.coupon !== undefined) {
        updateParams.coupon = updates.coupon;
      }

      // Add trial period
      if (updates.trialDays !== undefined) {
        updateParams.trial_period_days = updates.trialDays;
      }

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscriptionId,
        updateParams
      );

      logger.info('Updated Stripe subscription', {
        subscriptionId,
        plan: updates.plan
      });

      return updatedSubscription;
    } catch (error: any) {
      logger.error('Failed to update Stripe subscription:', error);
      throw new ExternalServiceError('Stripe', 'Failed to update subscription', error);
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      });

      logger.info('Canceled Stripe subscription', {
        subscriptionId,
        cancelAtPeriodEnd
      });

      return subscription;
    } catch (error: any) {
      logger.error('Failed to cancel Stripe subscription:', error);
      throw new ExternalServiceError('Stripe', 'Failed to cancel subscription', error);
    }
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false
      });

      logger.info('Resumed Stripe subscription', {
        subscriptionId
      });

      return subscription;
    } catch (error: any) {
      logger.error('Failed to resume Stripe subscription:', error);
      throw new ExternalServiceError('Stripe', 'Failed to resume subscription', error);
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'latest_invoice']
      });

      return subscription;
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        return null;
      }
      logger.error('Failed to get Stripe subscription:', error);
      throw new ExternalServiceError('Stripe', 'Failed to get subscription', error);
    }
  }

  /**
   * Get customer's subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        expand: ['data.customer']
      });

      return subscriptions.data;
    } catch (error: any) {
      logger.error('Failed to get customer subscriptions:', error);
      throw new ExternalServiceError('Stripe', 'Failed to get subscriptions', error);
    }
  }

  /**
   * Create a payment method and attach to customer
   */
  async createPaymentMethod(
    type: 'card' | 'bank_account',
    paymentMethodData: any
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.create({
        type,
        ...paymentMethodData
      });

      return paymentMethod;
    } catch (error: any) {
      logger.error('Failed to create payment method:', error);
      throw new ExternalServiceError('Stripe', 'Failed to create payment method', error);
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<void> {
    try {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } catch (error: any) {
      logger.error('Failed to attach payment method:', error);
      throw new ExternalServiceError('Stripe', 'Failed to attach payment method', error);
    }
  }

  /**
   * Get customer's payment methods
   */
  async getCustomerPaymentMethods(
    customerId: string,
    type: 'card' | 'bank_account' = 'card'
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type
      });

      return paymentMethods.data;
    } catch (error: any) {
      logger.error('Failed to get customer payment methods:', error);
      throw new ExternalServiceError('Stripe', 'Failed to get payment methods', error);
    }
  }

  /**
   * Create an invoice for one-time payment
   */
  async createInvoice(
    customerId: string,
    items: Array<{
      description: string;
      amount: number;
      currency?: string;
      quantity?: number;
    }>
  ): Promise<Stripe.Invoice> {
    try {
      // Create invoice items
      for (const item of items) {
        await this.stripe.invoiceItems.create({
          customer: customerId,
          amount: item.amount,
          currency: item.currency || config.stripe.currency,
          description: item.description,
          quantity: item.quantity || 1
        });
      }

      // Create and send invoice
      const invoice = await this.stripe.invoices.create({
        customer: customerId,
        auto_advance: true,
        collection_method: 'send_invoice',
        days_until_due: 30
      });

      await this.stripe.invoices.sendInvoice(invoice.id);

      logger.info('Created and sent invoice', {
        invoiceId: invoice.id,
        customerId
      });

      return invoice;
    } catch (error: any) {
      logger.error('Failed to create invoice:', error);
      throw new ExternalServiceError('Stripe', 'Failed to create invoice', error);
    }
  }

  /**
   * Process a one-time payment
   */
  async createPaymentIntent(
    customerId: string,
    amount: number,
    currency: string = 'usd',
    metadata: Record<string, string> = {}
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        automatic_payment_methods: {
          enabled: true
        },
        metadata
      });

      logger.info('Created payment intent', {
        paymentIntentId: paymentIntent.id,
        customerId,
        amount,
        currency
      });

      return paymentIntent;
    } catch (error: any) {
      logger.error('Failed to create payment intent:', error);
      throw new ExternalServiceError('Stripe', 'Failed to create payment intent', error);
    }
  }

  /**
   * Get available subscription plans
   */
  getSubscriptionPlans(): SubscriptionPlan[] {
    return [
      {
        id: 'basic',
        name: 'Basic',
        price: config.plans.basic.price,
        currency: config.plans.basic.currency,
        interval: config.plans.basic.interval as 'month' | 'year',
        features: config.plans.basic.features
      },
      {
        id: 'pro',
        name: 'Pro',
        price: config.plans.pro.price,
        currency: config.plans.pro.currency,
        interval: config.plans.pro.interval as 'month' | 'year',
        features: config.plans.pro.features
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: config.plans.enterprise.price,
        currency: config.plans.enterprise.currency,
        interval: config.plans.enterprise.interval as 'month' | 'year',
        features: config.plans.enterprise.features
      }
    ];
  }

  /**
   * Get price ID for a plan
   */
  private async getPriceId(plan: string): Promise<string> {
    // In a real implementation, you would store these in your database or environment
    const priceIds: { [key: string]: string } = {
      'basic': process.env.STRIPE_PRICE_BASIC_ID || '',
      'pro': process.env.STRIPE_PRICE_PRO_ID || '',
      'enterprise': process.env.STRIPE_PRICE_ENTERPRISE_ID || ''
    };

    const priceId = priceIds[plan];
    if (!priceId) {
      throw new Error(`Price ID not found for plan: ${plan}`);
    }

    return priceId;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string, signature: string): Stripe.Event | null {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );

      return event;
    } catch (error: any) {
      logger.error('Failed to verify Stripe webhook:', error);
      return null;
    }
  }

  /**
   * Get billing portal session
   */
  async createBillingPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<string> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      });

      return session.url;
    } catch (error: any) {
      logger.error('Failed to create billing portal session:', error);
      throw new ExternalServiceError('Stripe', 'Failed to create billing portal session', error);
    }
  }

  /**
   * Get invoice PDF URL
   */
  async getInvoicePdf(invoiceId: string): Promise<string | null> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      return invoice.invoice_pdf || null;
    } catch (error: any) {
      logger.error('Failed to get invoice PDF:', error);
      return null;
    }
  }
}

export const stripeService = new StripeService();
export default stripeService;
