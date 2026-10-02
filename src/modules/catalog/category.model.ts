import { Schema, model } from 'mongoose';
import { ICategoryDoc } from './category.types';

const categorySchema = new Schema<ICategoryDoc>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    path: {
      type: String,
      required: true,
      default: '/',
      index: true, // Allows instant subtree matching: { path: /^/electronics/ }
    },
    level: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Compound index for active category lookups under a parent
categorySchema.index({ parentId: 1, isActive: 1 });

export const CategoryModel = model<ICategoryDoc>('Category', categorySchema);
