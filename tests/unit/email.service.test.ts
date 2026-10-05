import { describe, it, expect, vi } from 'vitest';
import { emailService } from '../../src/modules/notifications/email.service';

describe('EmailService', () => {
  it('should successfully dispatch a welcome email with personalized customer data', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      emailService.sendWelcomeEmail({
        email: 'alexandra.vance@example.com',
        firstName: 'Alexandra',
        lastName: 'Vance',
      }),
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });

  it('should successfully dispatch an itemized order confirmation receipt', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      emailService.sendOrderConfirmationEmail({
        email: 'alexandra.vance@example.com',
        customerName: 'Alexandra Vance',
        order: {
          _id: '674e1234567890abcdef1234',
          orderNumber: 'ORD-20261005-AB12CD',
          createdAt: new Date().toISOString(),
          items: [
            {
              title: 'Aura Studio Acoustic ANC Headphones',
              sku: 'AUR-ANC-01',
              quantity: 1,
              unitPrice: 349.0,
              subtotal: 349.0,
              image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
            },
          ],
          pricing: {
            itemsSubtotal: 349.0,
            shippingFee: 0,
            taxAmount: 27.92,
            totalAmount: 376.92,
          },
          shippingAddress: {
            fullName: 'Alexandra Vance',
            street: '742 Evergreen Terrace',
            city: 'Springfield',
            state: 'OR',
            postalCode: '97477',
            country: 'United States',
          },
        },
      }),
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });
});
