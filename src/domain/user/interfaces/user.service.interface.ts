import {
  IPaginatedResult,
  IPagination,
} from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { IStorageProvider } from '../../common/providers/storage.provider';
import { IMovieEntryRepositoryWrite } from '../../movie-entry/repository/movie-entry.repository.write';
import { IWatchlistRepositoryWrite } from '../../watchlist/repository/watchlist.repository.write';
import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import {
  IUser,
  IUserPrivate,
  IUserPublicProfile,
  IUserPublicSummary,
} from './user.interface';

export interface IParamsCreateUser {
  name: string;
  email: string;
  password: string;
}

export interface IParamsUpdateUser {
  id: string;
  userData: Partial<Pick<IUser, 'name' | 'email'>>;
}

export interface IParamsChangePassword {
  id: string;
  currentPassword: string;
  newPassword: string;
}

export interface IParamsDeleteUser {
  id: string;
  password: string;
}

export interface IParamsListUsers {
  search?: string;
  pagination: IPagination;
}

export interface IParamsUserService {
  userRepositoryRead: IUserRepositoryRead;
  userRepositoryWrite: IUserRepositoryWrite;
  movieEntryRepositoryWrite: IMovieEntryRepositoryWrite;
  watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  storageProvider: IStorageProvider;
  passwordHasher: IPasswordHasher;
  clock: IClock;
}

export interface IUserService {
  createUser(params: IParamsCreateUser): Promise<IUserPrivate>;
  getUserById(id: string): Promise<IUserPrivate>;
  getUserByEmail(email: string): Promise<IUserPrivate>;
  updateUserById(params: IParamsUpdateUser): Promise<IUserPrivate>;
  changePassword(params: IParamsChangePassword): Promise<void>;
  deleteUser(params: IParamsDeleteUser): Promise<void>;
  listPublicUsers(
    params: IParamsListUsers,
  ): Promise<IPaginatedResult<IUserPublicSummary>>;
  getPublicProfile(id: string): Promise<IUserPublicProfile>;
}
