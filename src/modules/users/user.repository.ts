import { UserModel } from './user.model';
import { IUser, IUserDoc } from './user.types';

export class UserRepository {
  /**
   * Find a user by their unique email (lowercase).
   */
  public async findByEmail(email: string): Promise<IUserDoc | null> {
    return UserModel.findOne({ email: email.toLowerCase() });
  }

  /**
   * Find a user by email and explicitly select the passwordHash for authentication.
   */
  public async findByEmailWithPassword(email: string): Promise<IUserDoc | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshTokenVersion');
  }

  /**
   * Find a user by their ObjectId.
   */
  public async findById(id: string): Promise<IUserDoc | null> {
    return UserModel.findById(id);
  }

  /**
   * Find a user by their ObjectId and explicitly select refreshTokenVersion.
   */
  public async findByIdWithTokenVersion(id: string): Promise<IUserDoc | null> {
    return UserModel.findById(id).select('+refreshTokenVersion');
  }

  /**
   * Create and persist a new user record.
   */
  public async create(userData: Partial<IUser>): Promise<IUserDoc> {
    return UserModel.create(userData);
  }

  /**
   * Atomically increments the user's refreshTokenVersion.
   * This invalidates all outstanding refresh tokens belonging to the user.
   */
  public async incrementRefreshTokenVersion(userId: string): Promise<IUserDoc | null> {
    return UserModel.findByIdAndUpdate(
      userId,
      { $inc: { refreshTokenVersion: 1 } },
      { new: true },
    );
  }
}

export const userRepository = new UserRepository();
