import { Document, Types } from 'mongoose';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface IProductImage {
  url: string;
  alt?: string;
  isPrimary?: boolean;
}

export interface IProduct {
  title: string;
  slug: string;
  description: string;
  brand: string;
  categoryId: Types.ObjectId;
  sku: string;
  basePrice: number;
  salePrice?: number;
  images: IProductImage[];
  attributes: Record<string, string>;
  status: ProductStatus;
  ratingAverage: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductDoc extends IProduct, Document {
  _id: Types.ObjectId;
}

export interface ProductFilterQuery {
  category?: string;
  categoryId?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: ProductStatus;
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'rating';
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface CursorPaginatedProducts {
  items: IProductDoc[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}
