import { IPagination } from '../../common/pagination.interface';
import { IUser } from '../interfaces/user.interface';

export interface IUserRepositoryRead {
  findUserByEmail(email: string): Promise<IUser | null>;
  findUserById(id: string): Promise<IUser | null>;
  searchUsers(
    search: string | undefined,
    pagination: IPagination,
  ): Promise<IUser[]>;
  countUsers(search: string | undefined): Promise<number>;
}
