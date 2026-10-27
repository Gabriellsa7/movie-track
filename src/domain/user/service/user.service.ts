import { Logger } from 'traceability';
import { IUserRepositoryRead } from '../repository/user.repository.read';
import { IUserRepositoryWrite } from '../repository/user.repository.write';
import {
  IUser,
  IUserMoviesSummary,
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
  IParamsUploadAvatar,
  IParamsUserService,
  IUserService,
} from '../interfaces/user.service.interface';
import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import { UnauthorizedError } from '../../errors/unauthorized.error';
import { UnprocessableEntityError } from '../../errors/unprocessable-entity.error';
import { IMAGE_MIME_TYPES } from '../../common/image.mime-types';
import { IPaginatedResult } from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { IStorageProvider } from '../../common/providers/storage.provider';
import { IMovieEntryRepositoryRead } from '../../movie-entry/repository/movie-entry.repository.read';
import { IMovieEntryRepositoryWrite } from '../../movie-entry/repository/movie-entry.repository.write';
import { IWatchlistRepositoryWrite } from '../../watchlist/repository/watchlist.repository.write';
import { User } from '../user.entity';

const AVATAR_FOLDER = 'avatars';

const NO_MOVIES: IUserMoviesSummary = {
  moviesCount: 0,
  averageRating: null,
  favoritesCount: 0,
};

export class UserService implements IUserService {
  private userRepositoryRead: IUserRepositoryRead;
  private userRepositoryWrite: IUserRepositoryWrite;
  private movieEntryRepositoryRead: IMovieEntryRepositoryRead;
  private movieEntryRepositoryWrite: IMovieEntryRepositoryWrite;
  private watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  private storageProvider: IStorageProvider;
  private passwordHasher: IPasswordHasher;
  private clock: IClock;

  constructor({
    userRepositoryRead,
    userRepositoryWrite,
    movieEntryRepositoryRead,
    movieEntryRepositoryWrite,
    watchlistRepositoryWrite,
    storageProvider,
    passwordHasher,
    clock,
  }: IParamsUserService) {
    this.userRepositoryRead = userRepositoryRead;
    this.userRepositoryWrite = userRepositoryWrite;
    this.movieEntryRepositoryRead = movieEntryRepositoryRead;
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
    const existingUser = await this.findExistingUser(params.id);
    const user = new User(existingUser);
    user.updateProfile(params.userData, this.clock.now());

    // The e-mail is the login, so a stolen access token must not be enough to take the account over.
    if (user.email !== existingUser.email) {
      if (!params.currentPassword) {
        throw new UnprocessableEntityError(
          'currentPassword is required to change the e-mail',
          'CURRENT_PASSWORD_REQUIRED',
        );
      }
      await this.ensurePasswordMatches(params.currentPassword, existingUser);
    }

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
      sessionVersion: user.sessionVersion,
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
    const summaries = await this.findMoviesSummaries(
      users.map((user) => user._id),
    );
    return {
      items: users.map((user) =>
        User.toUserPublicSummary(user, summaries.get(user._id) ?? NO_MOVIES),
      ),
      total,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      limit: pagination.limit,
    };
  }

  @ErrorHandler()
  async getPublicProfile(id: string): Promise<IUserPublicProfile> {
    const user = await this.findExistingUser(id);
    const summaries = await this.findMoviesSummaries([user._id]);
    return User.toUserPublicProfile(user, summaries.get(user._id) ?? NO_MOVIES);
  }

  @ErrorHandler()
  async uploadAvatar(params: IParamsUploadAvatar): Promise<IUserPrivate> {
    if (!IMAGE_MIME_TYPES.includes(params.mimeType)) {
      throw new UnprocessableEntityError(
        'avatar must be a JPEG, PNG or WebP image',
        'INVALID_AVATAR_TYPE',
      );
    }
    const existingUser = await this.findExistingUser(params.id);
    const storedAvatar = await this.storageProvider.upload({
      buffer: params.buffer,
      mimeType: params.mimeType,
      folder: AVATAR_FOLDER,
    });

    const user = new User(existingUser);
    user.changeAvatar(storedAvatar.url, storedAvatar.publicId, this.clock.now());
    const updatedUser = await this.userRepositoryWrite.updateUserById(
      params.id,
      {
        avatarUrl: user.avatarUrl,
        avatarPublicId: user.avatarPublicId,
        updatedAt: user.updatedAt,
      },
    );
    if (!updatedUser) {
      // The account vanished meanwhile: do not leave an orphan file behind.
      await this.deleteStoredFile(storedAvatar.publicId);
      throw this.userNotFoundError();
    }

    if (existingUser.avatarPublicId) {
      await this.deleteStoredFile(existingUser.avatarPublicId);
    }
    return User.toUserPrivate(updatedUser);
  }

  @ErrorHandler()
  async removeAvatar(id: string): Promise<IUserPrivate> {
    const existingUser = await this.findExistingUser(id);
    if (!existingUser.avatarUrl) {
      return User.toUserPrivate(existingUser);
    }

    const user = new User(existingUser);
    user.removeAvatar(this.clock.now());
    const updatedUser = await this.userRepositoryWrite.updateUserById(id, {
      avatarUrl: user.avatarUrl,
      avatarPublicId: user.avatarPublicId,
      updatedAt: user.updatedAt,
    });
    if (!updatedUser) {
      throw this.userNotFoundError();
    }

    if (existingUser.avatarPublicId) {
      await this.deleteStoredFile(existingUser.avatarPublicId);
    }
    return User.toUserPrivate(updatedUser);
  }

  // One query for the whole page; users without movies are absent from the result.
  private async findMoviesSummaries(
    userIds: string[],
  ): Promise<Map<string, IUserMoviesSummary>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const summaries =
      await this.movieEntryRepositoryRead.getSummariesByUserIds(userIds);
    return new Map(
      summaries.map(({ userId, ...summary }) => [userId, summary]),
    );
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

  // A storage failure only leaves an orphan file, so it must not fail the request.
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
