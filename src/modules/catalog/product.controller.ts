import { Request, Response, NextFunction } from 'express';
import { productService, ProductService } from './product.service';
import { sendSuccess } from '../../app/utils/api-response';

export class ProductController {
  constructor(private readonly products: ProductService = productService) {}

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.products.createProduct(req.body);
      sendSuccess(res, { product }, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.products.getProducts(req.query as unknown as import('./product.schema').ProductQueryInput);

      // Check if it's cursor paginated or offset paginated
      if ('meta' in result) {
        sendSuccess(res, result.items, 'Products retrieved successfully', 200, result.meta);
      } else {
        sendSuccess(
          res,
          {
            items: result.items,
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
          },
          'Products retrieved successfully (cursor mode)',
          200,
        );
      }
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.products.getProductById(req.params.id as string);
      sendSuccess(res, { product }, 'Product retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.products.getProductBySlug(req.params.slug as string);
      sendSuccess(res, { product }, 'Product retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.products.updateProduct(req.params.id as string, req.body);
      sendSuccess(res, { product }, 'Product updated successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.products.deleteProduct(req.params.id as string);
      sendSuccess(res, null, 'Product archived successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public autocomplete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req.query.q as string) || '';
      const suggestions = await this.products.autocomplete(query);
      sendSuccess(res, { suggestions }, 'Autocomplete suggestions retrieved', 200);
    } catch (error) {
      next(error);
    }
  };
}

export const productController = new ProductController();
