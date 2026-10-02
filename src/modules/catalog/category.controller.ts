import { Request, Response, NextFunction } from 'express';
import { categoryService, CategoryService } from './category.service';
import { sendSuccess } from '../../app/utils/api-response';

export class CategoryController {
  constructor(private readonly categories: CategoryService = categoryService) {}

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await this.categories.createCategory(req.body);
      sendSuccess(res, { category }, 'Category created successfully', 201);
    } catch (error) {
      next(error);
    }
  };

  public getTree = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tree = await this.categories.getCategoryTree();
      sendSuccess(res, { tree }, 'Category tree retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public getBreadcrumbs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const breadcrumbs = await this.categories.getBreadcrumbs(req.params.id as string);
      sendSuccess(res, { breadcrumbs }, 'Breadcrumbs retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await this.categories.getCategoryBySlug(req.params.slug as string);
      sendSuccess(res, { category }, 'Category retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await this.categories.getCategoryById(req.params.id as string);
      sendSuccess(res, { category }, 'Category retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await this.categories.updateCategory(req.params.id as string, req.body);
      sendSuccess(res, { category }, 'Category updated successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.categories.deleteCategory(req.params.id as string);
      sendSuccess(res, null, 'Category deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  };
}

export const categoryController = new CategoryController();
