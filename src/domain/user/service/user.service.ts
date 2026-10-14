import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import { IUser } from '../interfaces/user.interface';
import {
  IParamsCreateUser,
  IParamsUpdateUser,
  IParamsUserService,
  IUserService,
} from '../interfaces/user.service.interface';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import { IPagination } from '../../common/pagination.interface';
import { User } from '../user.entity';

const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_LIST_OFFSET = 0;

export class UserService implements IUserService {
  private userRepositoryRead: IUserRepositoryRead;
  private userRepositoryWrite: IUserRepositoryWrite;

  constructor({ userRepositoryRead, userRepositoryWrite }: IParamsUserService) {
    this.userRepositoryRead = userRepositoryRead;
    this.userRepositoryWrite = userRepositoryWrite;
  }

  async createUser(params: IParamsCreateUser): Promise<IUser> {
    const existingUser = await this.userRepositoryRead.findUserByEmail(
      params.email,
    );
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const user = new User(
      params.id,
      params.name,
      params.email,
      params.password,
      params.createdAt,
    );
    return this.userRepositoryWrite.createUser(user);
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await this.userRepositoryRead.findUserById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<IUser> {
    const user = await this.userRepositoryRead.findUserByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async updateUserById(params: IParamsUpdateUser): Promise<IUser> {
    const updatedUser = await this.userRepositoryWrite.updateUserById(
      params.id,
      params.userData,
    );
    if (!updatedUser) {
      throw new NotFoundError('User not found');
    }
    return updatedUser;
  }

  async deleteUserById(id: string): Promise<IUser> {
    const deletedUser = await this.userRepositoryWrite.deleteUserById(id);
    if (!deletedUser) {
      throw new NotFoundError('User not found');
    }
    return deletedUser;
  }

  async listUsers(
    filter: Partial<IUser> = {},
    pagination: Partial<IPagination> = {},
  ): Promise<IUser[]> {
    const { limit = DEFAULT_LIST_LIMIT, offset = DEFAULT_LIST_OFFSET } =
      pagination;
    return this.userRepositoryRead.listUsers(filter, { limit, offset });
  }
}
