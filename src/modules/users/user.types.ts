import { Document, Types } from 'mongoose';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface IAddress {
  _id?: Types.ObjectId;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface IUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  addresses: IAddress[];
  refreshTokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDoc extends IUser, Document {
  _id: Types.ObjectId;
}

export type SafeUser = Omit<IUser, 'passwordHash' | 'refreshTokenVersion'> & {
  _id: string;
};
