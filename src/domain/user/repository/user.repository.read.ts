import { IPagination } from '../../common/pagination.interface';
import { IUser, IUserSearchFilter } from '../interfaces/user.interface';

export interface IUserRepositoryRead {
  findUserByEmail(email: string): Promise<IUser | null>;
  findUserById(id: string): Promise<IUser | null>;
  findUserByEmailVerificationTokenHash(
    tokenHash: string,
  ): Promise<IUser | null>;
  findUserByPasswordResetTokenHash(tokenHash: string): Promise<IUser | null>;
  searchUsers(
    filter: IUserSearchFilter,
    pagination: IPagination,
  ): Promise<IUser[]>;
  countUsers(filter: IUserSearchFilter): Promise<number>;
}
