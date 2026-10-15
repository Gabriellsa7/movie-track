import { IUser, IUserData } from '../interfaces/user.interface';

export interface IUserRepositoryWrite {
  createUser(userData: IUserData): Promise<IUser>;
  updateUserById(id: string, userData: Partial<IUserData>): Promise<IUser | null>;
  deleteUserById(id: string): Promise<IUser | null>;
}
