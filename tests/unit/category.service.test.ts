import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryService } from '../../src/modules/catalog/category.service';
import { CategoryRepository } from '../../src/modules/catalog/category.repository';
import { Types } from 'mongoose';
import { ICategoryDoc } from '../../src/modules/catalog/category.types';

describe('CategoryService (Tree Algorithm & Breadcrumbs)', () => {
  let categoryService: CategoryService;
  let mockCategoryRepo: CategoryRepository;

  const idElectronics = new Types.ObjectId().toString();
  const idAudio = new Types.ObjectId().toString();
  const idHeadphones = new Types.ObjectId().toString();

  const mockFlatCategories = [
    {
      _id: new Types.ObjectId(idElectronics),
      name: 'Electronics',
      slug: 'electronics',
      parentId: null,
      path: '/electronics',
      level: 0,
      isActive: true,
    } as unknown as ICategoryDoc,
    {
      _id: new Types.ObjectId(idAudio),
      name: 'Audio',
      slug: 'audio',
      parentId: new Types.ObjectId(idElectronics),
      path: '/electronics/audio',
      level: 1,
      isActive: true,
    } as unknown as ICategoryDoc,
    {
      _id: new Types.ObjectId(idHeadphones),
      name: 'Headphones',
      slug: 'headphones',
      parentId: new Types.ObjectId(idAudio),
      path: '/electronics/audio/headphones',
      level: 2,
      isActive: true,
    } as unknown as ICategoryDoc,
  ];

  beforeEach(() => {
    mockCategoryRepo = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findRootCategories: vi.fn(),
      findSubcategories: vi.fn(),
      findAllActive: vi.fn(),
      findDescendants: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as CategoryRepository;

    categoryService = new CategoryService(mockCategoryRepo);
  });

  it('should build a nested N-ary tree from flat category list in O(N) time', async () => {
    vi.spyOn(mockCategoryRepo, 'findAllActive').mockResolvedValue(mockFlatCategories);

    const tree = await categoryService.getCategoryTree();

    expect(tree).toHaveLength(1); // 1 root node: Electronics
    expect(tree[0].name).toBe('Electronics');
    expect(tree[0].children).toHaveLength(1); // Child: Audio
    expect(tree[0].children[0].name).toBe('Audio');
    expect(tree[0].children[0].children).toHaveLength(1); // Grandchild: Headphones
    expect(tree[0].children[0].children[0].name).toBe('Headphones');
  });

  it('should resolve breadcrumbs in O(H) using materialized path', async () => {
    vi.spyOn(mockCategoryRepo, 'findById').mockResolvedValue(mockFlatCategories[2]); // Headphones
    vi.spyOn(mockCategoryRepo, 'findBySlug').mockImplementation(async (slug: string) => {
      const found = mockFlatCategories.find((c) => c.slug === slug);
      return found || null;
    });

    const breadcrumbs = await categoryService.getBreadcrumbs(idHeadphones);

    expect(breadcrumbs).toHaveLength(3);
    expect(breadcrumbs[0].name).toBe('Electronics');
    expect(breadcrumbs[1].name).toBe('Audio');
    expect(breadcrumbs[2].name).toBe('Headphones');
  });
});
