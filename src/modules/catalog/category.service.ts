import { Types } from 'mongoose';
import { categoryRepository, CategoryRepository } from './category.repository';
import { CreateCategoryInput, UpdateCategoryInput } from './category.schema';
import { ICategoryDoc, CategoryTreeNode, CategoryBreadcrumb } from './category.types';
import { ConflictError, NotFoundError } from '../../app/errors/app-error';

export class CategoryService {
  constructor(private readonly categoryRepo: CategoryRepository = categoryRepository) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  public async createCategory(input: CreateCategoryInput): Promise<ICategoryDoc> {
    const slug = input.slug || this.slugify(input.name);

    const existing = await this.categoryRepo.findBySlug(slug);
    if (existing) {
      throw new ConflictError(`Category with slug '${slug}' already exists`);
    }

    let parentId: Types.ObjectId | null = null;
    let path = `/${slug}`;
    let level = 0;

    if (input.parentId) {
      const parent = await this.categoryRepo.findById(input.parentId);
      if (!parent) {
        throw new NotFoundError('Parent category not found');
      }
      parentId = parent._id;
      path = `${parent.path}/${slug}`;
      level = parent.level + 1;
    }

    return this.categoryRepo.create({
      name: input.name,
      slug,
      description: input.description,
      parentId,
      path,
      level,
      isActive: true,
    });
  }

  /**
   * DSA Algorithm: O(N) Hash Map Tree Construction.
   * Converts a flat array of database categories into an arbitrary-depth N-ary tree
   * in linear time without recursive database calls (solves the N+1 query problem).
   */
  public async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const flatCategories = await this.categoryRepo.findAllActive();

    const nodeMap = new Map<string, CategoryTreeNode>();
    const rootNodes: CategoryTreeNode[] = [];

    // Phase 1: Initialize tree node map in O(N)
    for (const cat of flatCategories) {
      const id = cat._id.toString();
      nodeMap.set(id, {
        id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        parentId: cat.parentId ? cat.parentId.toString() : null,
        level: cat.level,
        children: [],
      });
    }

    // Phase 2: Link children to parents in O(1) per node -> Total O(N)
    for (const node of nodeMap.values()) {
      if (!node.parentId) {
        rootNodes.push(node);
      } else {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // If parent is inactive or missing, treat as root
          rootNodes.push(node);
        }
      }
    }

    return rootNodes;
  }

  /**
   * Resolves breadcrumbs for navigation (e.g., Home > Electronics > Audio > Headphones).
   * Parses the materialized path "/electronics/audio/headphones" in O(H) time.
   */
  public async getBreadcrumbs(categoryId: string): Promise<CategoryBreadcrumb[]> {
    const category = await this.categoryRepo.findById(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Parse slugs from path: "/electronics/audio/headphones" -> ["electronics", "audio", "headphones"]
    const slugs = category.path.split('/').filter(Boolean);
    const breadcrumbs: CategoryBreadcrumb[] = [];

    for (const slug of slugs) {
      const cat = await this.categoryRepo.findBySlug(slug);
      if (cat) {
        breadcrumbs.push({
          id: cat._id.toString(),
          name: cat.name,
          slug: cat.slug,
        });
      }
    }

    return breadcrumbs;
  }

  public async getCategoryById(id: string): Promise<ICategoryDoc> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return category;
  }

  public async getCategoryBySlug(slug: string): Promise<ICategoryDoc> {
    const category = await this.categoryRepo.findBySlug(slug);
    if (!category) {
      throw new NotFoundError(`Category with slug '${slug}' not found`);
    }
    return category;
  }

  public async updateCategory(id: string, input: UpdateCategoryInput): Promise<ICategoryDoc> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const updated = await this.categoryRepo.update(id, input);
    if (!updated) {
      throw new NotFoundError('Failed to update category');
    }
    return updated;
  }

  public async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if category has subcategories
    const subcategories = await this.categoryRepo.findSubcategories(id);
    if (subcategories.length > 0) {
      throw new ConflictError('Cannot delete category with active subcategories. Move or delete them first.');
    }

    await this.categoryRepo.delete(id);
  }
}

export const categoryService = new CategoryService();
