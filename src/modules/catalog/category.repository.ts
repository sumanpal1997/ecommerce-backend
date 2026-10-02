import { Types } from 'mongoose';
import { CategoryModel } from './category.model';
import { ICategory, ICategoryDoc } from './category.types';

export class CategoryRepository {
  public async findById(id: string): Promise<ICategoryDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return CategoryModel.findById(id);
  }

  public async findBySlug(slug: string): Promise<ICategoryDoc | null> {
    return CategoryModel.findOne({ slug: slug.toLowerCase() });
  }

  public async findRootCategories(): Promise<ICategoryDoc[]> {
    return CategoryModel.find({ parentId: null, isActive: true }).sort({ name: 1 });
  }

  public async findSubcategories(parentId: string): Promise<ICategoryDoc[]> {
    if (!Types.ObjectId.isValid(parentId)) return [];
    return CategoryModel.find({ parentId: new Types.ObjectId(parentId), isActive: true }).sort({ name: 1 });
  }

  public async findAllActive(): Promise<ICategoryDoc[]> {
    return CategoryModel.find({ isActive: true }).sort({ level: 1, name: 1 });
  }

  public async findDescendants(parentPath: string): Promise<ICategoryDoc[]> {
    // Regex matches any path starting with parentPath (e.g. "/electronics/...")
    const regex = new RegExp(`^${parentPath}/`);
    return CategoryModel.find({ path: regex, isActive: true });
  }

  public async create(data: Partial<ICategory>): Promise<ICategoryDoc> {
    return CategoryModel.create(data);
  }

  public async update(id: string, data: Partial<ICategory>): Promise<ICategoryDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return CategoryModel.findByIdAndUpdate(id, data, { new: true });
  }

  public async delete(id: string): Promise<ICategoryDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return CategoryModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }
}

export const categoryRepository = new CategoryRepository();
