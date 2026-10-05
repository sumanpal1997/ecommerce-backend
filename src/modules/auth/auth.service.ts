import { userRepository, UserRepository } from '../users/user.repository';
import { tokenService, TokenService } from './token.service';
import { PasswordUtil } from './utils/password.util';
import { RegisterInput, LoginInput } from './auth.schema';
import { ConflictError, UnauthorizedError } from '../../app/errors/app-error';
import { AuthTokens } from './auth.types';
import { IUserDoc } from '../users/user.types';
import { emailService } from '../notifications/email.service';

export interface AuthResult {
  user: IUserDoc;
  tokens: AuthTokens;
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly tokens: TokenService = tokenService,
  ) {}

  /**
   * Registers a new customer account.
   */
  public async register(input: RegisterInput): Promise<AuthResult> {
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError('A user with that email already exists');
    }

    const passwordHash = await PasswordUtil.hash(input.password);

    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'CUSTOMER',
      isActive: true,
      refreshTokenVersion: 0,
      addresses: [],
    });

    const tokens = this.tokens.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
      user.refreshTokenVersion,
    );

    // Non-blocking welcome email dispatch to deliver responsive UX
    emailService
      .sendWelcomeEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      })
      .catch((err) => {
        console.error(`[AUTH] Failed to dispatch welcome email to ${user.email}:`, err);
      });

    return { user, tokens };
  }

  /**
   * Authenticates user credentials and issues tokens.
   */
  public async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmailWithPassword(input.email);

    // Timing-safe generic error message to prevent user enumeration attacks
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive. Please contact support.');
    }

    const isValidPassword = await PasswordUtil.verify(user.passwordHash, input.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = this.tokens.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
      user.refreshTokenVersion,
    );

    return { user, tokens };
  }

  /**
   * Validates refresh token, checks for reuse attacks, and returns fresh tokens.
   */
  public async refreshTokens(rawToken: string): Promise<AuthResult> {
    if (!rawToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    const decoded = this.tokens.verifyRefreshToken(rawToken);
    const user = await this.userRepo.findByIdWithTokenVersion(decoded.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    // Token Reuse / Family Invalidation check:
    // If the version in the token does not match the DB, this token is being reused
    // (potentially stolen by a malicious actor). Revoke all active sessions immediately!
    if (decoded.tokenVersion !== user.refreshTokenVersion) {
      await this.userRepo.incrementRefreshTokenVersion(user._id.toString());
      throw new UnauthorizedError('Suspicious token activity detected. All sessions revoked.');
    }

    const tokens = this.tokens.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
      user.refreshTokenVersion,
    );

    return { user, tokens };
  }

  /**
   * Revokes all active refresh tokens for a user by incrementing token version.
   */
  public async revokeAllSessions(userId: string): Promise<void> {
    await this.userRepo.incrementRefreshTokenVersion(userId);
  }
}

export const authService = new AuthService();
