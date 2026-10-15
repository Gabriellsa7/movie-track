import { IPagination } from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import { IUser, IUserPrivate } from './user.interface';

export interface IParamsCreateUser {
  name: string;
  email: string;
  password: string;
}

export interface IParamsUpdateUser {
  id: string;
  userData: Partial<Pick<IUser, 'name' | 'email'>>;
}

export interface IParamsUserService {
  userRepositoryRead: IUserRepositoryRead;
  userRepositoryWrite: IUserRepositoryWrite;
  passwordHasher: IPasswordHasher;
  clock: IClock;
}

export interface IUserService {
  createUser(params: IParamsCreateUser): Promise<IUserPrivate>;
  getUserById(id: string): Promise<IUserPrivate>;
  getUserByEmail(email: string): Promise<IUserPrivate>;
  updateUserById(params: IParamsUpdateUser): Promise<IUserPrivate>;
  deleteUserById(id: string): Promise<IUserPrivate>;
  listUsers(
    filter: Partial<IUser>,
    pagination?: Partial<IPagination>,
  ): Promise<IUserPrivate[]>;
}
