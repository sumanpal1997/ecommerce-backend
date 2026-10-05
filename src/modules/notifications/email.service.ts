import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../app/config/env.config';

export interface WelcomeEmailData {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface OrderConfirmationEmailData {
  email: string;
  customerName: string;
  order: {
    _id: string | unknown;
    orderNumber: string;
    createdAt?: Date | string;
    items: Array<{
      title: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      image?: string;
    }>;
    pricing: {
      itemsSubtotal: number;
      shippingFee: number;
      taxAmount: number;
      totalAmount: number;
    };
    shippingAddress: {
      fullName: string;
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isTestAccountReady = false;

  constructor() {
    this.initTransporter();
  }

  private async initTransporter(): Promise<void> {
    try {
      if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
        this.transporter = nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT || 587,
          secure: config.SMTP_PORT === 465,
          auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          },
        });
        console.log(`📧 Email service configured with SMTP host: ${config.SMTP_HOST}`);
      } else {
        // Development mode: Create ethereal test account or fallback logger
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.isTestAccountReady = true;
        console.log(`📧 Email service active in test mode (Ethereal test mailbox: ${testAccount.user})`);
      }
    } catch (err) {
      console.warn('⚠️ Could not initialize external email transporter, falling back to console logger:', err);
    }
  }

  /**
   * Sends a personalized Welcome Email upon successful customer registration.
   */
  public async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    const displayName = data.firstName
      ? `${data.firstName} ${data.lastName || ''}`.trim()
      : 'Valued Customer';

    const subject = `Welcome to ShopFlow Studio — Your Curated Lifestyle Account`;
    const storefrontUrl = config.CLIENT_URL;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to ShopFlow</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px 20px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #0f172a; padding: 32px; text-align: center; }
    .logo { color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-decoration: none; }
    .logo-badge { color: #818cf8; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .content { padding: 36px 32px; }
    h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0; }
    .perks-grid { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .perk-item { display: flex; margin-bottom: 12px; font-size: 13px; color: #334155; }
    .perk-item:last-child { margin-bottom: 0; }
    .perk-bullet { color: #4f46e5; font-weight: bold; margin-right: 8px; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-align: center; margin: 12px 0 24px 0; }
    .footer { border-top: 1px solid #f1f5f9; padding: 24px 32px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">SHOPFLOW</div>
      <div class="logo-badge">STUDIO • CURATED LIFESTYLE</div>
    </div>
    <div class="content">
      <h1>Welcome to ShopFlow, ${displayName}!</h1>
      <p>Thank you for creating your customer account. You now have privileged access to our curated selection of flagship computing workstations, studio acoustic audio, technical performance outerwear, and ergonomic furnishings.</p>
      
      <div class="perks-grid">
        <div class="perk-item"><span class="perk-bullet">✓</span><strong>100% Certified Authentic Guarantee</strong>&nbsp;— Inspected and verified directly with premium manufacturers.</div>
        <div class="perk-item"><span class="perk-bullet">✓</span><strong>Complimentary 2-Day Express Delivery</strong>&nbsp;— On all orders over $100 with white-glove courier handling.</div>
        <div class="perk-item"><span class="perk-bullet">✓</span><strong>30-Day Risk-Free Returns</strong>&nbsp;— Pre-paid return shipping labels available directly in your order history.</div>
        <div class="perk-item"><span class="perk-bullet">✓</span><strong>2-Year Comprehensive Warranty</strong>&nbsp;— Full manufacturer coverage on all electronics and hardware.</div>
      </div>

      <div style="text-align: center;">
        <a href="${storefrontUrl}" class="btn">Explore Curated Collections →</a>
      </div>

      <p style="font-size: 12px; color: #64748b;">Your account email: <strong>${data.email}</strong>. If you did not create this account, please notify our client concierge immediately.</p>
    </div>
    <div class="footer">
      © 2026 ShopFlow Studio Inc. • 100% Carbon-Neutral Fulfillment<br>
      Dedicated Concierge: concierge@shopflow.dev • London • New York • Tokyo
    </div>
  </div>
</body>
</html>
    `;

    await this.sendMail({
      to: data.email,
      subject,
      html,
      logPrefix: `[WELCOME EMAIL] Sent to ${data.email}`,
    });
  }

  /**
   * Sends an itemized Order Confirmation & Purchase Receipt Email upon successful payment.
   */
  public async sendOrderConfirmationEmail(data: OrderConfirmationEmailData): Promise<void> {
    const { order } = data;
    const trackingUrl = `${config.CLIENT_URL}/orders/${order._id}`;
    const subject = `Order Confirmed: ${order.orderNumber} — Thank you for your purchase!`;

    const formattedDate = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString('en-US', {
          dateStyle: 'medium',
        })
      : new Date().toLocaleDateString('en-US', { dateStyle: 'medium' });

    const itemsRows = order.items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 8px; font-size: 13px; font-weight: 600; color: #0f172a;">
            ${item.title}<br>
            <span style="font-size: 11px; font-family: monospace; color: #64748b;">SKU: ${item.sku}</span>
          </td>
          <td style="padding: 12px 8px; text-align: center; font-size: 13px; color: #334155; font-weight: 600;">
            ${item.quantity}
          </td>
          <td style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: 700; color: #0f172a;">
            $${item.subtotal.toFixed(2)}
          </td>
        </tr>
      `,
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Confirmation - ${order.orderNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #0f172a; padding: 32px; text-align: center; }
    .logo { color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    .logo-badge { color: #34d399; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .content { padding: 36px 32px; }
    h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0; }
    .order-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .order-meta-grid { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
    .order-meta-item strong { display: block; color: #0f172a; font-size: 13px; margin-top: 2px; }
    .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .items-header { border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; }
    .pricing-summary { border-top: 2px solid #e2e8f0; padding-top: 14px; margin-top: 10px; font-size: 13px; color: #475569; }
    .pricing-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .pricing-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #4f46e5; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 8px; }
    .btn { display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-align: center; margin: 20px 0; }
    .footer { border-top: 1px solid #f1f5f9; padding: 24px 32px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">SHOPFLOW STUDIO</div>
      <div class="logo-badge">ORDER CONFIRMED &amp; PAYMENT VERIFIED</div>
    </div>
    <div class="content">
      <h1>Thank you for your purchase, ${data.customerName}!</h1>
      <p>We are delighted to confirm that payment for order <strong>${order.orderNumber}</strong> was successfully verified. Your items have been securely allocated in our warehouse and are preparing for express dispatch.</p>
      
      <div class="order-box">
        <div class="order-meta-grid">
          <div class="order-meta-item">
            Order Reference
            <strong style="font-family: monospace;">${order.orderNumber}</strong>
          </div>
          <div class="order-meta-item">
            Date Placed
            <strong>${formattedDate}</strong>
          </div>
          <div class="order-meta-item">
            Status
            <strong style="color: #059669;">Paid &amp; Confirmed</strong>
          </div>
        </div>
      </div>

      <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-top: 24px;">Items in this Shipment</div>
      <table class="items-table">
        <thead>
          <tr class="items-header">
            <th style="padding: 8px; text-align: left;">Product</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="pricing-summary">
        <div class="pricing-row">
          <span>Items Subtotal:</span>
          <span style="font-weight: 600; color: #0f172a;">$${order.pricing.itemsSubtotal.toFixed(2)}</span>
        </div>
        <div class="pricing-row">
          <span>Express Delivery:</span>
          <span style="font-weight: 700; color: #059669;">${order.pricing.shippingFee === 0 ? 'FREE' : `$${order.pricing.shippingFee.toFixed(2)}`}</span>
        </div>
        <div class="pricing-row">
          <span>Estimated Sales Tax:</span>
          <span style="font-weight: 600; color: #0f172a;">$${order.pricing.taxAmount.toFixed(2)}</span>
        </div>
        <div class="pricing-total">
          <span>Total Paid:</span>
          <span>$${order.pricing.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div style="margin-top: 24px; padding: 14px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 12px;">
        <strong style="color: #0f172a;">Delivery Destination:</strong><br>
        <span style="color: #475569;">
          ${order.shippingAddress.fullName}<br>
          ${order.shippingAddress.street}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}<br>
          ${order.shippingAddress.country}
        </span>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${trackingUrl}" class="btn">Track Order Dispatch Live →</a>
      </div>
    </div>
    <div class="footer">
      Questions regarding your shipment? Contact our 24/7 Client Care at concierge@shopflow.dev.<br>
      © 2026 ShopFlow Studio Inc. • 100% Certified Authentic Guarantee
    </div>
  </div>
</body>
</html>
    `;

    await this.sendMail({
      to: data.email,
      subject,
      html,
      logPrefix: `[ORDER RECEIPT] Sent to ${data.email} for ${order.orderNumber} ($${order.pricing.totalAmount.toFixed(2)})`,
    });
  }

  /**
   * Internal dispatcher with graceful test-mode logging.
   */
  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    logPrefix: string;
  }): Promise<void> {
    try {
      if (!this.transporter) {
        await this.initTransporter();
      }

      if (this.transporter) {
        const info = await this.transporter.sendMail({
          from: config.EMAIL_FROM,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });

        console.log(`\n📬 ${options.logPrefix} (Message ID: ${info.messageId})`);
        if (this.isTestAccountReady) {
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            console.log(`🔗 Ethereal Live Email Web Preview: ${previewUrl}\n`);
          }
        }
      } else {
        console.log(`\n📬 [EMAIL SIMULATED]: ${options.logPrefix} — To: ${options.to} — Subject: ${options.subject}\n`);
      }
    } catch (error) {
      console.error(`❌ Failed to send email to ${options.to}:`, error);
    }
  }
}

export const emailService = new EmailService();
