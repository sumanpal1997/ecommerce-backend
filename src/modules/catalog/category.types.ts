import { Document, Types } from 'mongoose';

export interface ICategory {
  name: string;
  slug: string;
  description?: string;
  parentId: Types.ObjectId | null;
  path: string; // Materialized path, e.g., "/electronics/audio/headphones"
  level: number; // 0 for root, 1 for sub, etc.
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryDoc extends ICategory, Document {
  _id: Types.ObjectId;
}

export interface CategoryBreadcrumb {
  id: string;
  name: string;
  slug: string;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId: string | null;
  level: number;
  children: CategoryTreeNode[];
}
