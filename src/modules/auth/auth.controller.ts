import { Request, Response, NextFunction } from 'express';
import { authService, AuthService } from './auth.service';
import { tokenService, TokenService, REFRESH_COOKIE_NAME } from './token.service';
import { sendSuccess } from '../../app/utils/api-response';
import { userRepository, UserRepository } from '../users/user.repository';
import { NotFoundError, UnauthorizedError } from '../../app/errors/app-error';

export class AuthController {
  constructor(
    private readonly auth: AuthService = authService,
    private readonly tokens: TokenService = tokenService,
    private readonly users: UserRepository = userRepository,
  ) {}

  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, tokens } = await this.auth.register(req.body);

      this.tokens.setRefreshTokenCookie(res, tokens.refreshToken);

      sendSuccess(
        res,
        {
          user,
          accessToken: tokens.accessToken,
        },
        'User registered successfully',
        201,
      );
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, tokens } = await this.auth.login(req.body);

      this.tokens.setRefreshTokenCookie(res, tokens.refreshToken);

      sendSuccess(
        res,
        {
          user,
          accessToken: tokens.accessToken,
        },
        'Logged in successfully',
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

      if (!rawToken) {
        throw new UnauthorizedError('Refresh token required');
      }

      const { user, tokens } = await this.auth.refreshTokens(rawToken);

      this.tokens.setRefreshTokenCookie(res, tokens.refreshToken);

      sendSuccess(
        res,
        {
          user,
          accessToken: tokens.accessToken,
        },
        'Tokens refreshed successfully',
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.tokens.clearRefreshTokenCookie(res);

      if (req.user?.id) {
        await this.auth.revokeAllSessions(req.user.id);
      }

      sendSuccess(res, null, 'Logged out successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const user = await this.users.findById(req.user.id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      sendSuccess(res, { user }, 'User profile retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
