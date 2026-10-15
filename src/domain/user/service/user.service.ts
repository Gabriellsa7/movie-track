import { randomUUID } from 'crypto';
import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import { IUser, IUserPrivate } from '../interfaces/user.interface';
import {
  IParamsCreateUser,
  IParamsUpdateUser,
  IParamsUserService,
  IUserService,
} from '../interfaces/user.service.interface';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import { IPagination } from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { User } from '../user.entity';

const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_LIST_OFFSET = 0;
const EMAIL_TAKEN_MESSAGE = 'A user with this email already exists';

export class UserService implements IUserService {
  private userRepositoryRead: IUserRepositoryRead;
  private userRepositoryWrite: IUserRepositoryWrite;
  private passwordHasher: IPasswordHasher;
  private clock: IClock;

  constructor({
    userRepositoryRead,
    userRepositoryWrite,
    passwordHasher,
    clock,
  }: IParamsUserService) {
    this.userRepositoryRead = userRepositoryRead;
    this.userRepositoryWrite = userRepositoryWrite;
    this.passwordHasher = passwordHasher;
    this.clock = clock;
  }

  async createUser(params: IParamsCreateUser): Promise<IUserPrivate> {
    const email = this.normalizeEmail(params.email);
    const existingUser = await this.userRepositoryRead.findUserByEmail(email);
    if (existingUser) {
      throw new ConflictError(EMAIL_TAKEN_MESSAGE);
    }

    const passwordHash = await this.passwordHasher.hash(params.password);
    const now = this.clock.now();
    const user = new User(
      randomUUID(),
      params.name.trim(),
      email,
      passwordHash,
      now,
      now,
    );
    const createdUser = await this.userRepositoryWrite.createUser(user);
    return this.toUserPrivate(createdUser);
  }

  async getUserById(id: string): Promise<IUserPrivate> {
    const user = await this.userRepositoryRead.findUserById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.toUserPrivate(user);
  }

  async getUserByEmail(email: string): Promise<IUserPrivate> {
    const user = await this.userRepositoryRead.findUserByEmail(
      this.normalizeEmail(email),
    );
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.toUserPrivate(user);
  }

  async updateUserById(params: IParamsUpdateUser): Promise<IUserPrivate> {
    const { name, email } = params.userData;
    const userData: Partial<IUser> = { updatedAt: this.clock.now() };

    if (name !== undefined) {
      userData.name = name.trim();
    }
    if (email !== undefined) {
      userData.email = this.normalizeEmail(email);
      const userWithEmail = await this.userRepositoryRead.findUserByEmail(
        userData.email,
      );
      if (userWithEmail && userWithEmail.id !== params.id) {
        throw new ConflictError(EMAIL_TAKEN_MESSAGE);
      }
    }

    const updatedUser = await this.userRepositoryWrite.updateUserById(
      params.id,
      userData,
    );
    if (!updatedUser) {
      throw new NotFoundError('User not found');
    }
    return this.toUserPrivate(updatedUser);
  }

  async deleteUserById(id: string): Promise<IUserPrivate> {
    const deletedUser = await this.userRepositoryWrite.deleteUserById(id);
    if (!deletedUser) {
      throw new NotFoundError('User not found');
    }
    return this.toUserPrivate(deletedUser);
  }

  async listUsers(
    filter: Partial<IUser> = {},
    pagination: Partial<IPagination> = {},
  ): Promise<IUserPrivate[]> {
    const { limit = DEFAULT_LIST_LIMIT, offset = DEFAULT_LIST_OFFSET } =
      pagination;
    const users = await this.userRepositoryRead.listUsers(filter, {
      limit,
      offset,
    });
    return users.map((user) => this.toUserPrivate(user));
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toUserPrivate(user: IUser): IUserPrivate {
    const { passwordHash, avatarPublicId, ...userPrivate } = user;
    return userPrivate;
  }
}
