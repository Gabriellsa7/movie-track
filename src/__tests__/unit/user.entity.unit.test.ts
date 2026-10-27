import { User } from '../../domain/user/user.entity';
import { IUser } from '../../domain/user/interfaces/user.interface';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-02-01T00:00:00.000Z');

const A_USER: IUser = {
  _id: 'user-1',
  name: 'Whitebeard',
  email: 'whitebeard@email.com',
  passwordHash: 'hashed-secret123',
  avatarUrl: 'https://cdn.example.com/avatar.png',
  avatarPublicId: 'avatars/user-1',
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

describe('When we create a user entity', () => {
  it('should normalize name and email and leave the id to the database', () => {
    const user = new User({
      name: '  Whitebeard  ',
      email: ' WhiteBeard@Email.com ',
      passwordHash: 'hashed-secret123',
      createdAt: CREATED_AT,
    });

    expect(user).not.toHaveProperty('_id');
    expect(user.name).toBe('Whitebeard');
    expect(user.email).toBe('whitebeard@email.com');
    expect(user.updatedAt).toBe(CREATED_AT);
    expect(user).not.toHaveProperty('avatarUrl');
    expect(user).not.toHaveProperty('avatarPublicId');
  });

  it('should keep every field of an existing user', () => {
    const user = new User(A_USER);

    expect({ ...user }).toEqual(A_USER);
  });

  it('should default the dates to now when none is given', () => {
    const before = Date.now();

    const user = new User({
      name: 'Whitebeard',
      email: 'whitebeard@email.com',
      passwordHash: 'hashed-secret123',
    });

    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(user.updatedAt).toBe(user.createdAt);
  });
});

describe('When we update a user profile', () => {
  it('should normalize the given fields and touch updatedAt', () => {
    const user = new User(A_USER);

    user.updateProfile({ name: ' Edward ', email: 'EDWARD@email.com' }, LATER);

    expect(user.name).toBe('Edward');
    expect(user.email).toBe('edward@email.com');
    expect(user.updatedAt).toBe(LATER);
  });

  it('should keep the fields that were not given', () => {
    const user = new User(A_USER);

    user.updateProfile({}, LATER);

    expect(user.name).toBe(A_USER.name);
    expect(user.email).toBe(A_USER.email);
    expect(user.updatedAt).toBe(LATER);
  });
});

describe('When we change a user password hash', () => {
  it('should replace the hash and touch updatedAt', () => {
    const user = new User(A_USER);

    user.changePasswordHash('hashed-newSecret456', LATER);

    expect(user.passwordHash).toBe('hashed-newSecret456');
    expect(user.updatedAt).toBe(LATER);
  });

  it('should bump the session version, starting from 0 when the user has none', () => {
    const user = new User(A_USER);

    user.changePasswordHash('hashed-1', LATER);
    expect(user.sessionVersion).toBe(1);

    user.changePasswordHash('hashed-2', LATER);
    expect(user.sessionVersion).toBe(2);
  });

  it('should keep the session version it was built with', () => {
    expect(new User({ ...A_USER, sessionVersion: 5 }).sessionVersion).toBe(5);
    expect(new User(A_USER)).not.toHaveProperty('sessionVersion');
  });
});

describe('When we change the avatar of a user', () => {
  it('should set the new avatar and its storage id', () => {
    const user = new User(A_USER);

    user.changeAvatar('https://cdn.example.com/new.png', 'avatars/new', LATER);

    expect(user.avatarUrl).toBe('https://cdn.example.com/new.png');
    expect(user.avatarPublicId).toBe('avatars/new');
    expect(user.updatedAt).toBe(LATER);
  });

  it('should clear the avatar and its storage id when removed', () => {
    const user = new User(A_USER);

    user.removeAvatar(LATER);

    expect(user.avatarUrl).toBeUndefined();
    expect(user.avatarPublicId).toBeUndefined();
    expect(user.updatedAt).toBe(LATER);
  });
});

describe('When we map a user to its responses', () => {
  it('should hide the password hash, avatar public id and session version from the private view', () => {
    expect(User.toUserPrivate({ ...A_USER, sessionVersion: 1 })).toEqual({
      id: A_USER._id,
      name: A_USER.name,
      email: A_USER.email,
      avatarUrl: A_USER.avatarUrl,
      createdAt: A_USER.createdAt,
      updatedAt: A_USER.updatedAt,
    });
  });

  it('should expose only public fields and the movies summary in the summary and profile', () => {
    const moviesSummary = {
      moviesCount: 3,
      averageRating: 7.5,
      favoritesCount: 1,
    };

    expect(User.toUserPublicSummary(A_USER, moviesSummary)).toEqual({
      id: A_USER._id,
      name: A_USER.name,
      avatarUrl: A_USER.avatarUrl,
      ...moviesSummary,
    });
    expect(User.toUserPublicProfile(A_USER, moviesSummary)).toEqual({
      id: A_USER._id,
      name: A_USER.name,
      avatarUrl: A_USER.avatarUrl,
      memberSince: A_USER.createdAt,
      ...moviesSummary,
    });
  });

  it('should omit the avatar when the user has none', () => {
    const userWithoutAvatar = { ...A_USER, avatarUrl: undefined };

    expect(User.toUserPrivate(userWithoutAvatar)).not.toHaveProperty(
      'avatarUrl',
    );
    expect(
      User.toUserPublicSummary(userWithoutAvatar, {
        moviesCount: 0,
        averageRating: null,
        favoritesCount: 0,
      }),
    ).not.toHaveProperty(
      'avatarUrl',
    );
  });
});
