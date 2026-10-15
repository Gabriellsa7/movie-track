import { randomUUID } from 'crypto';
import '../../../jest/setup-integration-tests';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';
import { UserRepositoryWrite } from '../../infrastructure/repository/user/user.repository.write';

const SEARCH_PREFIX = `repo${Date.now()}`;

const buildUser = (name: string): IUser => ({
  id: randomUUID(),
  name,
  email: `${randomUUID()}@email.com`,
  passwordHash: 'hashed-secret123',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const userRepositoryRead = new UserRepositoryRead();
const userRepositoryWrite = new UserRepositoryWrite();

describe('When we persist a user', () => {
  it('should store the normalized name without returning it', async () => {
    const user = buildUser(`${SEARCH_PREFIX} José Álvares`);

    await userRepositoryWrite.createUser(user);
    const userInDb = await Muser.findOne({ id: user.id }).lean();
    const foundUser = await userRepositoryRead.findUserById(user.id);

    expect(userInDb?.normalizedName).toBe(`${SEARCH_PREFIX} jose alvares`);
    expect(foundUser).not.toHaveProperty('normalizedName');
  });

  it('should refresh the normalized name when the name is updated', async () => {
    const user = buildUser(`${SEARCH_PREFIX} Old Name`);
    await userRepositoryWrite.createUser(user);

    const updatedUser = await userRepositoryWrite.updateUserById(user.id, {
      name: `${SEARCH_PREFIX} Nova Ação`,
    });
    const userInDb = await Muser.findOne({ id: user.id }).lean();

    expect(userInDb?.normalizedName).toBe(`${SEARCH_PREFIX} nova acao`);
    expect(updatedUser).not.toHaveProperty('normalizedName');
  });
});

describe('When we update a user without changing the name', () => {
  it('should keep the normalized name on partial updates and saves', async () => {
    const user = buildUser(`${SEARCH_PREFIX} Kept Name`);
    await userRepositoryWrite.createUser(user);

    await userRepositoryWrite.updateUserById(user.id, {
      email: `${randomUUID()}@email.com`,
    });
    const userDocument = await Muser.findOne({ id: user.id });
    userDocument!.updatedAt = new Date();
    await userDocument!.save();
    const userInDb = await Muser.findOne({ id: user.id }).lean();

    expect(userInDb?.normalizedName).toBe(`${SEARCH_PREFIX} kept name`);
  });

  it('should normalize names sent through a $set update', async () => {
    const user = buildUser(`${SEARCH_PREFIX} Before`);
    await userRepositoryWrite.createUser(user);

    await Muser.findOneAndUpdate(
      { id: user.id },
      { $set: { name: `${SEARCH_PREFIX} Depois Já` } },
    );
    const userInDb = await Muser.findOne({ id: user.id }).lean();

    expect(userInDb?.normalizedName).toBe(`${SEARCH_PREFIX} depois ja`);
  });
});

describe('When we search users by name', () => {
  beforeAll(async () => {
    await Muser.create([
      buildUser(`${SEARCH_PREFIX}-search Zoë`),
      buildUser(`${SEARCH_PREFIX}-search ana`),
      buildUser(`${SEARCH_PREFIX}-search Ânia`),
    ]);
  });

  it('should match ignoring case and accents, sorted by name', async () => {
    const users = await userRepositoryRead.searchUsers(
      `${SEARCH_PREFIX}-SEARCH A`,
      { limit: 10, offset: 0 },
    );

    expect(users.map((user) => user.name)).toEqual([
      `${SEARCH_PREFIX}-search ana`,
      `${SEARCH_PREFIX}-search Ânia`,
    ]);
    expect(users[0]).not.toHaveProperty('normalizedName');
  });

  it('should paginate and count the matches', async () => {
    const search = `${SEARCH_PREFIX}-search`;

    const users = await userRepositoryRead.searchUsers(search, {
      limit: 1,
      offset: 2,
    });
    const total = await userRepositoryRead.countUsers(search);

    expect(users.map((user) => user.name)).toEqual([
      `${SEARCH_PREFIX}-search Zoë`,
    ]);
    expect(total).toBe(3);
  });

  it('should treat regex characters in the search as plain text', async () => {
    const total = await userRepositoryRead.countUsers('.*');

    expect(total).toBe(0);
  });

  it('should return everyone when the search is blank', async () => {
    const total = await userRepositoryRead.countUsers('   ');
    const allUsers = await Muser.countDocuments();

    expect(total).toBe(allUsers);
    await expect(userRepositoryRead.countUsers(undefined)).resolves.toBe(
      allUsers,
    );
  });
});
