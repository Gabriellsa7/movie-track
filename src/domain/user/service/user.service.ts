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
    const existingUser = await this.userRepositoryRead.findUserByEmail(
      User.normalizeEmail(params.email),
    );
    if (existingUser) {
      throw this.emailTakenError();
    }

    const user = new User({
      name: params.name,
      email: params.email,
      passwordHash: await this.passwordHasher.hash(params.password),
      createdAt: this.clock.now(),
    });
    const createdUser = await this.userRepositoryWrite.createUser(user);
    return User.toUserPrivate(createdUser);
  }

  async getUserById(id: string): Promise<IUserPrivate> {
    return User.toUserPrivate(await this.findExistingUser(id));
  }

  async getUserByEmail(email: string): Promise<IUserPrivate> {
    const user = await this.userRepositoryRead.findUserByEmail(
      User.normalizeEmail(email),
    );
    if (!user) {
      throw this.userNotFoundError();
    }
    return User.toUserPrivate(user);
  }

  async updateUserById(params: IParamsUpdateUser): Promise<IUserPrivate> {
    const user = new User(await this.findExistingUser(params.id));
    user.updateProfile(params.userData, this.clock.now());

    if (params.userData.email !== undefined) {
      const userWithEmail = await this.userRepositoryRead.findUserByEmail(
        user.email,
      );
      if (userWithEmail && userWithEmail.id !== user.id) {
        throw this.emailTakenError();
      }
    }

    const updatedUser = await this.userRepositoryWrite.updateUserById(
      user.id,
      { name: user.name, email: user.email, updatedAt: user.updatedAt },
    );
    if (!updatedUser) {
      throw this.userNotFoundError();
    }
    return User.toUserPrivate(updatedUser);
  }

  async changePassword(params: IParamsChangePassword): Promise<void> {
    const user = new User(await this.findExistingUser(params.id));
    await this.ensurePasswordMatches(params.currentPassword, user);

    user.changePasswordHash(
      await this.passwordHasher.hash(params.newPassword),
      this.clock.now(),
    );
    await this.userRepositoryWrite.updateUserById(user.id, {
      passwordHash: user.passwordHash,
      updatedAt: user.updatedAt,
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
      items: users.map((user) => User.toUserPublicSummary(user)),
      total,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      limit: pagination.limit,
    };
  }

  async getPublicProfile(id: string): Promise<IUserPublicProfile> {
    return User.toUserPublicProfile(await this.findExistingUser(id));
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

  private emailTakenError(): ConflictError {
    return new ConflictError(
      'A user with this email already exists',
      'EMAIL_TAKEN',
    );
  }

  private userNotFoundError(): NotFoundError {
    return new NotFoundError('User not found', 'USER_NOT_FOUND');
  }
}
