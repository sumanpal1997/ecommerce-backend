import { z } from 'zod';

export const createProductSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe (e.g., sony-wh-1000xm5)')
    .optional(),
  description: z.string().trim().min(5, 'Description must be at least 5 characters'),
  brand: z.string().trim().min(1, 'Brand is required'),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Category ID format'),
  sku: z.string().trim().min(3, 'SKU must be at least 3 characters').toUpperCase(),
  basePrice: z.number().positive('Base price must be greater than zero'),
  salePrice: z.number().positive('Sale price must be greater than zero').optional(),
  images: z
    .array(
      z.object({
        url: z.string().url('Image must be a valid URL'),
        alt: z.string().optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .min(1, 'At least one product image is required'),
  initialStock: z.number().int().min(0, 'Initial stock cannot be negative').optional().default(0),
  attributes: z.record(z.string(), z.string()).optional().default({}),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  category: z.string().optional(),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  maxPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  search: z.string().optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'newest', 'rating']).optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
  cursor: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
