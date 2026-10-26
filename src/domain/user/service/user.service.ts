import { Logger } from 'traceability';
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
import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import { UnauthorizedError } from '../../errors/unauthorized.error';
import { IPaginatedResult } from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { IStorageProvider } from '../../common/providers/storage.provider';
import { IMovieEntryRepositoryWrite } from '../../movie-entry/repository/movie-entry.repository.write';
import { IWatchlistRepositoryWrite } from '../../watchlist/repository/watchlist.repository.write';
import { User } from '../user.entity';

export class UserService implements IUserService {
  private userRepositoryRead: IUserRepositoryRead;
  private userRepositoryWrite: IUserRepositoryWrite;
  private movieEntryRepositoryWrite: IMovieEntryRepositoryWrite;
  private watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  private storageProvider: IStorageProvider;
  private passwordHasher: IPasswordHasher;
  private clock: IClock;

  constructor({
    userRepositoryRead,
    userRepositoryWrite,
    movieEntryRepositoryWrite,
    watchlistRepositoryWrite,
    storageProvider,
    passwordHasher,
    clock,
  }: IParamsUserService) {
    this.userRepositoryRead = userRepositoryRead;
    this.userRepositoryWrite = userRepositoryWrite;
    this.movieEntryRepositoryWrite = movieEntryRepositoryWrite;
    this.watchlistRepositoryWrite = watchlistRepositoryWrite;
    this.storageProvider = storageProvider;
    this.passwordHasher = passwordHasher;
    this.clock = clock;
  }

  @ErrorHandler()
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

  @ErrorHandler()
  async getUserById(id: string): Promise<IUserPrivate> {
    return User.toUserPrivate(await this.findExistingUser(id));
  }

  @ErrorHandler()
  async getUserByEmail(email: string): Promise<IUserPrivate> {
    const user = await this.userRepositoryRead.findUserByEmail(
      User.normalizeEmail(email),
    );
    if (!user) {
      throw this.userNotFoundError();
    }
    return User.toUserPrivate(user);
  }

  @ErrorHandler()
  async updateUserById(params: IParamsUpdateUser): Promise<IUserPrivate> {
    const user = new User(await this.findExistingUser(params.id));
    user.updateProfile(params.userData, this.clock.now());

    if (params.userData.email !== undefined) {
      const userWithEmail = await this.userRepositoryRead.findUserByEmail(
        user.email,
      );
      if (userWithEmail && userWithEmail._id !== params.id) {
        throw this.emailTakenError();
      }
    }

    const updatedUser = await this.userRepositoryWrite.updateUserById(
      params.id,
      { name: user.name, email: user.email, updatedAt: user.updatedAt },
    );
    if (!updatedUser) {
      throw this.userNotFoundError();
    }
    return User.toUserPrivate(updatedUser);
  }

  @ErrorHandler()
  async changePassword(params: IParamsChangePassword): Promise<void> {
    const user = new User(await this.findExistingUser(params.id));
    await this.ensurePasswordMatches(params.currentPassword, user);

    user.changePasswordHash(
      await this.passwordHasher.hash(params.newPassword),
      this.clock.now(),
    );
    await this.userRepositoryWrite.updateUserById(params.id, {
      passwordHash: user.passwordHash,
      updatedAt: user.updatedAt,
    });
  }

  @ErrorHandler()
  async deleteUser(params: IParamsDeleteUser): Promise<void> {
    const user = await this.findExistingUser(params.id);
    await this.ensurePasswordMatches(params.password, user);
    await this.userRepositoryWrite.deleteUserById(params.id);
    await this.deleteUserData(user);
  }

  @ErrorHandler()
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

  @ErrorHandler()
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

  // Runs after the account is gone: a failure here leaves unreachable rows, never an account missing its movies.
  private async deleteUserData(user: IUser): Promise<void> {
    const [movieEntries] = await Promise.all([
      this.movieEntryRepositoryWrite.deleteMovieEntriesByUserId(user._id),
      this.watchlistRepositoryWrite.deleteWatchlistItemsByUserId(user._id),
    ]);
    const publicIds = [
      user.avatarPublicId,
      ...movieEntries.map((movieEntry) => movieEntry.posterPublicId),
    ].filter((publicId): publicId is string => Boolean(publicId));
    await Promise.all(
      publicIds.map((publicId) => this.deleteStoredFile(publicId)),
    );
  }

  // A storage failure only leaves an orphan file, so it must not fail the account deletion.
  private async deleteStoredFile(publicId: string): Promise<void> {
    try {
      await this.storageProvider.delete(publicId);
    } catch (error) {
      Logger.warn('Failed to delete a user file from storage', {
        eventName: 'user.file.delete_failed',
        publicId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async ensurePasswordMatches(
    password: string,
    user: Pick<IUser, 'passwordHash'>,
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
