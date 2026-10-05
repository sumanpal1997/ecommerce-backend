import { Types } from 'mongoose';
import { ProductModel } from './product.model';
import { CategoryModel } from './category.model';
import {
  CursorPaginatedProducts,
  IProduct,
  IProductDoc,
  ProductFilterQuery,
} from './product.types';
import { PaginationMeta } from '../../app/utils/api-response';

export class ProductRepository {
  public async create(data: Partial<IProduct>): Promise<IProductDoc> {
    return ProductModel.create(data);
  }

  public async findById(id: string): Promise<IProductDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return ProductModel.findById(id).populate('categoryId', 'name slug');
  }

  public async findBySlug(slug: string): Promise<IProductDoc | null> {
    return ProductModel.findOne({ slug: slug.toLowerCase() }).populate('categoryId', 'name slug');
  }

  public async findBySku(sku: string): Promise<IProductDoc | null> {
    return ProductModel.findOne({ sku: sku.toUpperCase() });
  }

  public async findByIds(ids: string[]): Promise<IProductDoc[]> {
    const validObjectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    return ProductModel.find({ _id: { $in: validObjectIds } });
  }

  public async update(id: string, data: Partial<IProduct>): Promise<IProductDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return ProductModel.findByIdAndUpdate(id, data, { new: true });
  }

  public async delete(id: string): Promise<IProductDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return ProductModel.findByIdAndUpdate(id, { status: 'ARCHIVED' }, { new: true });
  }

  private async buildMongooseFilter(query: ProductFilterQuery): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = {};

    // By default, only return ACTIVE products unless explicitly specified
    filter.status = query.status || 'ACTIVE';

    const categoryTarget = query.category || query.categoryId;
    if (categoryTarget && categoryTarget !== 'all') {
      let matchedCategory;
      if (Types.ObjectId.isValid(categoryTarget)) {
        matchedCategory = await CategoryModel.findById(categoryTarget);
      } else {
        matchedCategory = await CategoryModel.findOne({ slug: categoryTarget.toLowerCase() });
      }

      if (matchedCategory) {
        // Subtree match using materialized path: matches category itself and all children
        const escapedPath = matchedCategory.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const descendantCategories = await CategoryModel.find({
          path: { $regex: new RegExp(`^${escapedPath}(/|$)`) },
          isActive: true,
        }).select('_id');

        const categoryIds = descendantCategories.map((c) => c._id);
        filter.categoryId = { $in: categoryIds };
      } else {
        // Category not found
        filter.categoryId = new Types.ObjectId();
      }
    }

    if (query.brand) {
      filter.brand = query.brand;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (query.minPrice !== undefined) {
        priceFilter.$gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        priceFilter.$lte = query.maxPrice;
      }
      filter.basePrice = priceFilter;
    }

    if (query.search && query.search.trim().length > 0) {
      filter.$text = { $search: query.search.trim() };
    }

    return filter;
  }

  private buildSort(sortBy?: string): Record<string, 1 | -1> {
    switch (sortBy) {
      case 'price_asc':
        return { basePrice: 1 };
      case 'price_desc':
        return { basePrice: -1 };
      case 'rating':
        return { ratingAverage: -1 };
      case 'newest':
      default:
        return { createdAt: -1 };
    }
  }

  /**
   * Offset Pagination: Suitable for desktop admin grids or pages with direct page jump navigators.
   */
  public async findWithOffsetPagination(
    query: ProductFilterQuery,
  ): Promise<{ items: IProductDoc[]; meta: PaginationMeta }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter = await this.buildMongooseFilter(query);
    const sort = this.buildSort(query.sortBy);

    const [items, totalItems] = await Promise.all([
      ProductModel.find(filter).sort(sort).skip(skip).limit(limit).populate('categoryId', 'name slug'),
      ProductModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Scalable Cursor Pagination: O(log N) lookup utilizing the _id index.
   * Avoids the O(N) skip degradation on massive collections (e.g. mobile infinite feeds).
   */
  public async findWithCursorPagination(query: ProductFilterQuery): Promise<CursorPaginatedProducts> {
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const filter = await this.buildMongooseFilter(query);

    // If cursor is provided, fetch items created before this cursor (descending by _id)
    if (query.cursor && Types.ObjectId.isValid(query.cursor)) {
      filter._id = { $lt: new Types.ObjectId(query.cursor) };
    }

    // Fetch limit + 1 to determine if another page exists without an extra count query
    const items = await ProductModel.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('categoryId', 'name slug');

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop(); // Remove the extra check item
    }

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

    return {
      items,
      nextCursor,
      hasMore,
      limit,
    };
  }

  /**
   * Fetches active product titles for warming the Autocomplete Trie.
   */
  public async getProductTitlesForTrie(): Promise<{ title: string; slug: string; brand: string }[]> {
    return ProductModel.find({ status: 'ACTIVE' }, { title: 1, slug: 1, brand: 1 }).lean();
  }
}

export const productRepository = new ProductRepository();
