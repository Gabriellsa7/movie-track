import { Logger } from 'traceability';
import { UserService } from '../../domain/user/service/user.service';
import { IUserRepositoryRead } from '../../domain/user/repository/user.repository.read';
import { IUserRepositoryWrite } from '../../domain/user/repository/user.repository.write';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { IPasswordHasher } from '../../domain/common/providers/password-hasher.provider';
import { IClock } from '../../domain/common/providers/clock.provider';
import { IStorageProvider } from '../../domain/common/providers/storage.provider';
import { IMovieEntry } from '../../domain/movie-entry/interfaces/movie-entry.interface';
import { IMovieEntryRepositoryRead } from '../../domain/movie-entry/repository/movie-entry.repository.read';
import { IMovieEntryRepositoryWrite } from '../../domain/movie-entry/repository/movie-entry.repository.write';
import { IWatchlistRepositoryWrite } from '../../domain/watchlist/repository/watchlist.repository.write';
import { ConflictError } from '../../domain/errors/conflict.error';
import { NotFoundError } from '../../domain/errors/not-found.error';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error';

const NOW = new Date('2026-02-01T00:00:00.000Z');

const A_USER: IUser = {
  _id: 'user-1',
  name: 'Whitebeard',
  email: 'whitebeard@email.com',
  passwordHash: 'hashed-secret123',
  avatarUrl: 'https://cdn.example.com/avatar.png',
  avatarPublicId: 'avatars/user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const A_USER_PRIVATE = {
  id: A_USER._id,
  name: A_USER.name,
  email: A_USER.email,
  avatarUrl: A_USER.avatarUrl,
  createdAt: A_USER.createdAt,
  updatedAt: A_USER.updatedAt,
};

let userRepositoryRead: jest.Mocked<IUserRepositoryRead>;
let userRepositoryWrite: jest.Mocked<IUserRepositoryWrite>;
let movieEntryRepositoryRead: jest.Mocked<
  Pick<IMovieEntryRepositoryRead, 'getSummariesByUserIds'>
>;
let movieEntryRepositoryWrite: jest.Mocked<IMovieEntryRepositoryWrite>;
let watchlistRepositoryWrite: jest.Mocked<IWatchlistRepositoryWrite>;
let storageProvider: jest.Mocked<IStorageProvider>;
let passwordHasher: jest.Mocked<IPasswordHasher>;
let clock: jest.Mocked<IClock>;
let userService: UserService;

beforeEach(() => {
  userRepositoryRead = {
    findUserById: jest.fn(),
    findUserByEmail: jest.fn(),
    searchUsers: jest.fn(),
    countUsers: jest.fn(),
  };
  userRepositoryWrite = {
    createUser: jest.fn(),
    updateUserById: jest.fn(),
    deleteUserById: jest.fn(),
  };
  movieEntryRepositoryRead = {
    getSummariesByUserIds: jest.fn().mockResolvedValue([]),
  };
  movieEntryRepositoryWrite = {
    createMovieEntry: jest.fn(),
    updateMovieEntryById: jest.fn(),
    deleteMovieEntryById: jest.fn(),
    deleteMovieEntriesByUserId: jest.fn().mockResolvedValue([]),
  };
  watchlistRepositoryWrite = {
    createWatchlistItem: jest.fn(),
    deleteWatchlistItemById: jest.fn(),
    deleteWatchlistItemsByUserId: jest.fn(),
  };
  storageProvider = { upload: jest.fn(), delete: jest.fn() };
  passwordHasher = {
    hash: jest.fn(async (plainPassword: string) => `hashed-${plainPassword}`),
    compare: jest.fn(),
  };
  clock = { now: jest.fn(() => NOW) };
  userService = new UserService({
    userRepositoryRead,
    userRepositoryWrite,
    movieEntryRepositoryRead:
      movieEntryRepositoryRead as unknown as IMovieEntryRepositoryRead,
    movieEntryRepositoryWrite,
    watchlistRepositoryWrite,
    storageProvider,
    passwordHasher,
    clock,
  });
});

describe('When we create a user', () => {
  it('should persist a hashed password and let the database generate the id', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(null);
    userRepositoryWrite.createUser.mockImplementation(async (user) => ({
      ...user,
      _id: 'user-1',
    }));

    const createdUser = await userService.createUser({
      name: '  Whitebeard  ',
      email: ' WhiteBeard@Email.com ',
      password: 'secret123',
    });

    const persistedUser = userRepositoryWrite.createUser.mock.calls[0][0];
    expect(persistedUser).toMatchObject({
      name: 'Whitebeard',
      email: 'whitebeard@email.com',
      passwordHash: 'hashed-secret123',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(persistedUser).not.toHaveProperty('_id');
    expect(createdUser.id).toBe('user-1');
    expect(passwordHasher.hash).toHaveBeenCalledWith('secret123');
    expect(createdUser).not.toHaveProperty('passwordHash');
    expect(createdUser).not.toHaveProperty('avatarPublicId');
  });

  it('should throw ConflictError when the email is already in use', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);

    await expect(
      userService.createUser({
        name: 'Whitebeard',
        email: 'WHITEBEARD@email.com',
        password: 'secret123',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
    expect(userRepositoryRead.findUserByEmail).toHaveBeenCalledWith(
      'whitebeard@email.com',
    );
    expect(userRepositoryWrite.createUser).not.toHaveBeenCalled();
  });
});

describe('When we get a user by ID', () => {
  it('should return the user without private fields when it exists', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);

    const user = await userService.getUserById(A_USER._id);

    expect(user).toEqual(A_USER_PRIVATE);
    expect(userRepositoryRead.findUserById).toHaveBeenCalledWith(A_USER._id);
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(userService.getUserById('missing-id')).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('When we get a user by email', () => {
  it('should look up the normalized email and return the user', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);

    const user = await userService.getUserByEmail(' WhiteBeard@Email.com ');

    expect(user).toEqual(A_USER_PRIVATE);
    expect(userRepositoryRead.findUserByEmail).toHaveBeenCalledWith(
      A_USER.email,
    );
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(null);

    await expect(
      userService.getUserByEmail('missing@email.com'),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('When we update a user', () => {
  it('should update the name and updatedAt and return the user', async () => {
    const updatedUser = { ...A_USER, name: 'Edward Newgate', updatedAt: NOW };
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    userRepositoryWrite.updateUserById.mockResolvedValue(updatedUser);

    const result = await userService.updateUserById({
      id: A_USER._id,
      userData: { name: ' Edward Newgate ' },
    });

    expect(result).toEqual({
      ...A_USER_PRIVATE,
      name: 'Edward Newgate',
      updatedAt: NOW,
    });
    expect(userRepositoryWrite.updateUserById).toHaveBeenCalledWith(A_USER._id, {
      name: 'Edward Newgate',
      email: A_USER.email,
      updatedAt: NOW,
    });
    expect(userRepositoryRead.findUserByEmail).not.toHaveBeenCalled();
  });

  it('should normalize the email and keep it when it belongs to the same user', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);
    userRepositoryWrite.updateUserById.mockResolvedValue(A_USER);

    await userService.updateUserById({
      id: A_USER._id,
      userData: { email: 'WHITEBEARD@email.com' },
    });

    expect(userRepositoryRead.findUserByEmail).toHaveBeenCalledWith(
      A_USER.email,
    );
    expect(userRepositoryWrite.updateUserById).toHaveBeenCalledWith(A_USER._id, {
      name: A_USER.name,
      email: A_USER.email,
      updatedAt: NOW,
    });
  });

  it('should throw ConflictError when the email belongs to another user', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    userRepositoryRead.findUserByEmail.mockResolvedValue({
      ...A_USER,
      _id: 'user-2',
    });

    await expect(
      userService.updateUserById({
        id: A_USER._id,
        userData: { email: A_USER.email },
      }),
    ).rejects.toThrow(ConflictError);
    expect(userRepositoryWrite.updateUserById).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(
      userService.updateUserById({ id: 'missing-id', userData: {} }),
    ).rejects.toThrow(NotFoundError);
    expect(userRepositoryWrite.updateUserById).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the user is deleted before the write', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    userRepositoryWrite.updateUserById.mockResolvedValue(null);

    await expect(
      userService.updateUserById({ id: A_USER._id, userData: {} }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('When we change a user password', () => {
  it('should store the new hash when the current password matches', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    passwordHasher.compare.mockResolvedValue(true);

    await userService.changePassword({
      id: A_USER._id,
      currentPassword: 'secret123',
      newPassword: 'newSecret456',
    });

    expect(passwordHasher.compare).toHaveBeenCalledWith(
      'secret123',
      A_USER.passwordHash,
    );
    expect(userRepositoryWrite.updateUserById).toHaveBeenCalledWith(A_USER._id, {
      passwordHash: 'hashed-newSecret456',
      sessionVersion: 1,
      updatedAt: NOW,
    });
  });

  it('should bump the session version to revoke the older refresh tokens', async () => {
    userRepositoryRead.findUserById.mockResolvedValue({
      ...A_USER,
      sessionVersion: 3,
    });
    passwordHasher.compare.mockResolvedValue(true);

    await userService.changePassword({
      id: A_USER._id,
      currentPassword: 'secret123',
      newPassword: 'newSecret456',
    });

    expect(userRepositoryWrite.updateUserById).toHaveBeenCalledWith(
      A_USER._id,
      expect.objectContaining({ sessionVersion: 4 }),
    );
  });

  it('should throw UnauthorizedError when the current password is wrong', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      userService.changePassword({
        id: A_USER._id,
        currentPassword: 'wrong123',
        newPassword: 'newSecret456',
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(userRepositoryWrite.updateUserById).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(
      userService.changePassword({
        id: 'missing-id',
        currentPassword: 'secret123',
        newPassword: 'newSecret456',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
  });
});

describe('When we delete a user confirming the password', () => {
  it('should delete the user when the password matches', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    passwordHasher.compare.mockResolvedValue(true);

    await userService.deleteUser({ id: A_USER._id, password: 'secret123' });

    expect(userRepositoryWrite.deleteUserById).toHaveBeenCalledWith(A_USER._id);
  });

  it('should throw UnauthorizedError and keep the user when the password is wrong', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      userService.deleteUser({ id: A_USER._id, password: 'wrong123' }),
    ).rejects.toThrow(UnauthorizedError);
    expect(userRepositoryWrite.deleteUserById).not.toHaveBeenCalled();
    expect(
      movieEntryRepositoryWrite.deleteMovieEntriesByUserId,
    ).not.toHaveBeenCalled();
    expect(storageProvider.delete).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(
      userService.deleteUser({ id: 'missing-id', password: 'secret123' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('When we delete a user that has movies, a watchlist and files', () => {
  beforeEach(() => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    passwordHasher.compare.mockResolvedValue(true);
    movieEntryRepositoryWrite.deleteMovieEntriesByUserId.mockResolvedValue([
      { posterPublicId: 'posters/uploaded' } as IMovieEntry,
      { posterUrl: 'https://example.com/external.png' } as IMovieEntry,
    ]);
  });

  it('should delete their movies and watchlist items', async () => {
    await userService.deleteUser({ id: A_USER._id, password: 'secret123' });

    expect(
      movieEntryRepositoryWrite.deleteMovieEntriesByUserId,
    ).toHaveBeenCalledWith(A_USER._id);
    expect(
      watchlistRepositoryWrite.deleteWatchlistItemsByUserId,
    ).toHaveBeenCalledWith(A_USER._id);
  });

  it('should delete the uploaded posters and the avatar from storage', async () => {
    await userService.deleteUser({ id: A_USER._id, password: 'secret123' });

    expect(storageProvider.delete).toHaveBeenCalledTimes(2);
    expect(storageProvider.delete).toHaveBeenCalledWith('posters/uploaded');
    expect(storageProvider.delete).toHaveBeenCalledWith(A_USER.avatarPublicId);
  });

  it('should still succeed and log a warning when the storage fails', async () => {
    storageProvider.delete.mockRejectedValue(new Error('storage down'));
    const warnSpy = jest
      .spyOn(Logger, 'warn')
      .mockImplementation(() => Logger);

    await expect(
      userService.deleteUser({ id: A_USER._id, password: 'secret123' }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to delete a user file from storage',
      expect.objectContaining({
        eventName: 'user.file.delete_failed',
        publicId: 'posters/uploaded',
        error: 'storage down',
      }),
    );
    warnSpy.mockRestore();
  });
});

const NO_MOVIES = { moviesCount: 0, averageRating: null, favoritesCount: 0 };

describe('When we list public users', () => {
  it('should return only public fields with pagination metadata', async () => {
    userRepositoryRead.searchUsers.mockResolvedValue([A_USER]);
    userRepositoryRead.countUsers.mockResolvedValue(41);

    const result = await userService.listPublicUsers({
      search: 'white',
      pagination: { limit: 20, offset: 40 },
    });

    expect(result).toEqual({
      items: [
        {
          id: A_USER._id,
          name: A_USER.name,
          avatarUrl: A_USER.avatarUrl,
          ...NO_MOVIES,
        },
      ],
      total: 41,
      page: 3,
      limit: 20,
    });
    expect(userRepositoryRead.searchUsers).toHaveBeenCalledWith('white', {
      limit: 20,
      offset: 40,
    });
    expect(userRepositoryRead.countUsers).toHaveBeenCalledWith('white');
  });

  it('should add each user movies summary with a single query', async () => {
    const anotherUser = { ...A_USER, _id: 'user-2', name: 'Marco' };
    userRepositoryRead.searchUsers.mockResolvedValue([A_USER, anotherUser]);
    userRepositoryRead.countUsers.mockResolvedValue(2);
    movieEntryRepositoryRead.getSummariesByUserIds.mockResolvedValue([
      {
        userId: 'user-2',
        moviesCount: 4,
        averageRating: 8.3,
        favoritesCount: 2,
      },
    ]);

    const result = await userService.listPublicUsers({
      pagination: { limit: 20, offset: 0 },
    });

    expect(
      movieEntryRepositoryRead.getSummariesByUserIds,
    ).toHaveBeenCalledTimes(1);
    expect(
      movieEntryRepositoryRead.getSummariesByUserIds,
    ).toHaveBeenCalledWith([A_USER._id, 'user-2']);
    expect(result.items).toEqual([
      expect.objectContaining({ id: A_USER._id, ...NO_MOVIES }),
      expect.objectContaining({
        id: 'user-2',
        moviesCount: 4,
        averageRating: 8.3,
        favoritesCount: 2,
      }),
    ]);
  });

  it('should not query the movies when the page is empty', async () => {
    userRepositoryRead.searchUsers.mockResolvedValue([]);
    userRepositoryRead.countUsers.mockResolvedValue(0);

    await userService.listPublicUsers({ pagination: { limit: 20, offset: 0 } });

    expect(
      movieEntryRepositoryRead.getSummariesByUserIds,
    ).not.toHaveBeenCalled();
  });
});

describe('When we get a public profile', () => {
  it('should return public fields and the member since date', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);

    const profile = await userService.getPublicProfile(A_USER._id);

    expect(profile).toEqual({
      id: A_USER._id,
      name: A_USER.name,
      avatarUrl: A_USER.avatarUrl,
      memberSince: A_USER.createdAt,
      ...NO_MOVIES,
    });
  });

  it('should include the movies summary of the user', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);
    movieEntryRepositoryRead.getSummariesByUserIds.mockResolvedValue([
      {
        userId: A_USER._id,
        moviesCount: 2,
        averageRating: 9,
        favoritesCount: 0,
      },
    ]);

    const profile = await userService.getPublicProfile(A_USER._id);

    expect(profile).toMatchObject({
      moviesCount: 2,
      averageRating: 9,
      favoritesCount: 0,
    });
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(userService.getPublicProfile('missing-id')).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('When a user repository fails unexpectedly', () => {
  it('should log the failure with the service context and rethrow it', async () => {
    const loggerErrorSpy = jest
      .spyOn(Logger, 'error')
      .mockImplementation(() => Logger);
    userRepositoryRead.findUserById.mockRejectedValue(
      new Error('database down'),
    );

    await expect(userService.getUserById(A_USER._id)).rejects.toThrow(
      'database down',
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Unexpected error in UserService.getUserById',
      expect.objectContaining({
        eventName: 'service.unexpected_error',
        service: 'UserService',
        method: 'getUserById',
      }),
    );
    loggerErrorSpy.mockRestore();
  });

  it('should not log domain errors', async () => {
    const loggerErrorSpy = jest
      .spyOn(Logger, 'error')
      .mockImplementation(() => Logger);
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(userService.getUserById('missing-id')).rejects.toThrow(
      NotFoundError,
    );
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    loggerErrorSpy.mockRestore();
  });
});
