import { randomUUID } from 'crypto';
import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import {
  IUser,
  IUserPrivate,
  IUserPublicProfile,
  IUserPublicSummary,
} from '../interfaces/user.interface';
import {
  IParamsChangePassword,
  IParamsCreateUser,
  IParamsDeleteUser,
  IParamsListUsers,
  IParamsUpdateUser,
  IParamsUserService,
  IUserService,
} from '../interfaces/user.service.interface';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import { UnauthorizedError } from '../../errors/unauthorized.error';
import { IPaginatedResult } from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { User } from '../user.entity';

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
      throw this.emailTakenError();
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
    return this.toUserPrivate(await this.findExistingUser(id));
  }

  async getUserByEmail(email: string): Promise<IUserPrivate> {
    const user = await this.userRepositoryRead.findUserByEmail(
      this.normalizeEmail(email),
    );
    if (!user) {
      throw this.userNotFoundError();
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
        throw this.emailTakenError();
      }
    }

    const updatedUser = await this.userRepositoryWrite.updateUserById(
      params.id,
      userData,
    );
    if (!updatedUser) {
      throw this.userNotFoundError();
    }
    return this.toUserPrivate(updatedUser);
  }

  async changePassword(params: IParamsChangePassword): Promise<void> {
    const user = await this.findExistingUser(params.id);
    await this.ensurePasswordMatches(params.currentPassword, user);

    const passwordHash = await this.passwordHasher.hash(params.newPassword);
    await this.userRepositoryWrite.updateUserById(params.id, {
      passwordHash,
      updatedAt: this.clock.now(),
    });
  }

  async deleteUser(params: IParamsDeleteUser): Promise<void> {
    const user = await this.findExistingUser(params.id);
    await this.ensurePasswordMatches(params.password, user);
    await this.userRepositoryWrite.deleteUserById(params.id);
  }

  async listPublicUsers(
    params: IParamsListUsers,
  ): Promise<IPaginatedResult<IUserPublicSummary>> {
    const { search, pagination } = params;
    const [users, total] = await Promise.all([
      this.userRepositoryRead.searchUsers(search, pagination),
      this.userRepositoryRead.countUsers(search),
    ]);
    return {
      items: users.map((user) => this.toUserPublicSummary(user)),
      total,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      limit: pagination.limit,
    };
  }

  async getPublicProfile(id: string): Promise<IUserPublicProfile> {
    const user = await this.findExistingUser(id);
    return {
      ...this.toUserPublicSummary(user),
      memberSince: user.createdAt,
    };
  }

  private async findExistingUser(id: string): Promise<IUser> {
    const user = await this.userRepositoryRead.findUserById(id);
    if (!user) {
      throw this.userNotFoundError();
    }
    return user;
  }

  private async ensurePasswordMatches(
    password: string,
    user: IUser,
  ): Promise<void> {
    const matches = await this.passwordHasher.compare(
      password,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private emailTakenError(): ConflictError {
    return new ConflictError(
      'A user with this email already exists',
      'EMAIL_TAKEN',
    );
  }

  private userNotFoundError(): NotFoundError {
    return new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  private toUserPrivate(user: IUser): IUserPrivate {
    const { passwordHash, avatarPublicId, ...userPrivate } = user;
    return userPrivate;
  }

  private toUserPublicSummary(user: IUser): IUserPublicSummary {
    return { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
  }
}
