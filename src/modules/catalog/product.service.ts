import { Types } from 'mongoose';
import { productRepository, ProductRepository } from './product.repository';
import { categoryRepository, CategoryRepository } from './category.repository';
import { catalogTrie, AutocompleteTrie, TrieItem } from './dsa/trie';
import {
  CreateProductInput,
  ProductQueryInput,
  UpdateProductInput,
} from './product.schema';
import {
  CursorPaginatedProducts,
  IProductDoc,
} from './product.types';
import { ConflictError, NotFoundError } from '../../app/errors/app-error';
import { PaginationMeta } from '../../app/utils/api-response';
import { inventoryService, InventoryService } from '../inventory/inventory.service';

export class ProductService {
  constructor(
    private readonly productRepo: ProductRepository = productRepository,
    private readonly categoryRepo: CategoryRepository = categoryRepository,
    private readonly trie: AutocompleteTrie = catalogTrie,
    private readonly inventory: InventoryService = inventoryService,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  public async createProduct(input: CreateProductInput): Promise<IProductDoc> {
    const slug = input.slug || this.slugify(input.title);

    // 1. Verify Category Exists
    const category = await this.categoryRepo.findById(input.categoryId);
    if (!category || !category.isActive) {
      throw new NotFoundError('Category does not exist or is inactive');
    }

    // 2. Check Slug Conflict
    const existingSlug = await this.productRepo.findBySlug(slug);
    if (existingSlug) {
      throw new ConflictError(`Product with slug '${slug}' already exists`);
    }

    // 3. Check SKU Conflict
    const existingSku = await this.productRepo.findBySku(input.sku);
    if (existingSku) {
      throw new ConflictError(`Product with SKU '${input.sku}' already exists`);
    }

    const product = await this.productRepo.create({
      title: input.title,
      slug,
      description: input.description,
      brand: input.brand,
      categoryId: new Types.ObjectId(input.categoryId),
      sku: input.sku.toUpperCase(),
      basePrice: input.basePrice,
      salePrice: input.salePrice,
      images: input.images,
      attributes: input.attributes || {},
      status: input.status || 'ACTIVE',
      ratingAverage: 0,
      ratingCount: 0,
    });

    // Populate Trie for instant typeahead
    this.trie.insert({ term: product.title, slug: product.slug, score: 10 });
    this.trie.insert({ term: product.brand, score: 5 });

    // Initialize inventory record for this product SKU
    await this.inventory.initializeStock(
      product._id.toString(),
      product.sku,
      input.initialStock || 0,
    );

    return product;
  }

  public async getProducts(
    query: ProductQueryInput,
  ): Promise<
    | { items: IProductDoc[]; meta: PaginationMeta }
    | CursorPaginatedProducts
  > {
    if (query.cursor !== undefined) {
      return this.productRepo.findWithCursorPagination(query);
    }
    return this.productRepo.findWithOffsetPagination(query);
  }

  public async getProductById(id: string): Promise<IProductDoc> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    return product;
  }

  public async getProductBySlug(slug: string): Promise<IProductDoc> {
    const product = await this.productRepo.findBySlug(slug);
    if (!product) {
      throw new NotFoundError(`Product with slug '${slug}' not found`);
    }
    return product;
  }

  public async updateProduct(id: string, input: UpdateProductInput): Promise<IProductDoc> {
    const existing = await this.productRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    if (input.categoryId) {
      const category = await this.categoryRepo.findById(input.categoryId);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    const updated = await this.productRepo.update(id, input as unknown as Partial<IProductDoc>);
    if (!updated) {
      throw new NotFoundError('Failed to update product');
    }
    return updated;
  }

  public async deleteProduct(id: string): Promise<void> {
    const existing = await this.productRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Product not found');
    }
    await this.productRepo.delete(id);
  }

  /**
   * Fast Typeahead Autocomplete using in-memory Trie with catalog fallback.
   */
  public async autocomplete(prefix: string): Promise<TrieItem[]> {
    if (!prefix || prefix.trim().length === 0) return [];

    const trieResults = this.trie.search(prefix, 8);
    if (trieResults.length >= 4) {
      return trieResults;
    }

    try {
      const escaped = prefix.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const dbMatches = await this.productRepo.searchCatalog(regex, 6);

      const combined: TrieItem[] = [...trieResults];
      const seenSlugs = new Set(combined.map((c) => c.slug).filter(Boolean));
      const seenTerms = new Set(combined.map((c) => c.term.toLowerCase()));

      for (const p of dbMatches) {
        if (!seenSlugs.has(p.slug) && !seenTerms.has(p.title.toLowerCase())) {
          seenSlugs.add(p.slug);
          seenTerms.add(p.title.toLowerCase());
          combined.push({ term: p.title, slug: p.slug, score: 7 });
        }
      }

      return combined.slice(0, 8);
    } catch {
      return trieResults;
    }
  }

  /**
   * Pre-warms the in-memory Trie from persistent storage on server boot.
   */
  public async warmTrie(): Promise<void> {
    this.trie.clear();
    const products = await this.productRepo.getProductTitlesForTrie();
    for (const prod of products) {
      // 1. Full title
      this.trie.insert({ term: prod.title, slug: prod.slug, score: 10 });
      // 2. Brand
      this.trie.insert({ term: prod.brand, score: 8 });

      // 3. Sub-phrases from title so "MacBook", "AirPods", "Aeron", "SoundLink" match
      const words = prod.title.split(/[\s-]+/).filter((w) => w.length >= 2);
      for (let i = 1; i < words.length; i++) {
        const subphrase = words.slice(i).join(' ');
        this.trie.insert({ term: subphrase, slug: prod.slug, score: 9 });
      }
      for (const word of words) {
        if (word.length >= 3 && word.toLowerCase() !== prod.brand.toLowerCase()) {
          this.trie.insert({ term: word, slug: prod.slug, score: 6 });
        }
      }
    }
  }
}

export const productService = new ProductService();
