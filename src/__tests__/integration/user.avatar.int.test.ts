import { randomUUID } from 'crypto';
import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { fakeUserStorageProvider, userApp } from '../configUserApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const A_PNG = Buffer.from('fake png bytes');

async function createUser(avatar?: {
  avatarUrl: string;
  avatarPublicId: string;
}): Promise<string> {
  const userId = newObjectId();
  await Muser.create({
    _id: userId,
    email: `avatar-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    passwordHash: 'hashed-secret123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...avatar,
  });
  return userId;
}

const uploadAvatar = (userId: string, tokenUserId = userId) =>
  supertest(userApp.app)
    .put(`/users/${userId}/avatar`)
    .set('Authorization', authHeaderFor(tokenUserId));

const removeAvatar = (userId: string) =>
  supertest(userApp.app)
    .delete(`/users/${userId}/avatar`)
    .set('Authorization', authHeaderFor(userId));

beforeEach(() => {
  fakeUserStorageProvider.delete.mockReset();
  fakeUserStorageProvider.upload.mockReset();
  fakeUserStorageProvider.upload.mockResolvedValue({
    url: 'https://cdn.example.com/avatars/new.png',
    publicId: 'avatars/new',
  });
});

describe('When we upload our avatar', () => {
  it('should return 200 with the new avatar and store the file', async () => {
    const userId = await createUser();

    const { body, statusCode } = await uploadAvatar(userId).attach(
      'avatar',
      A_PNG,
      { filename: 'avatar.png', contentType: 'image/png' },
    );

    expect(statusCode).toBe(200);
    expect(body.avatarUrl).toBe('https://cdn.example.com/avatars/new.png');
    expect(body).not.toHaveProperty('avatarPublicId');
    expect(fakeUserStorageProvider.upload).toHaveBeenCalledWith({
      buffer: A_PNG,
      mimeType: 'image/png',
      folder: 'avatars',
    });
    const inDb = await Muser.findById(userId).lean();
    expect(inDb?.avatarPublicId).toBe('avatars/new');
  });

  it('should delete the previous avatar', async () => {
    const userId = await createUser({
      avatarUrl: 'https://cdn.example.com/avatars/old.png',
      avatarPublicId: 'avatars/old',
    });

    await uploadAvatar(userId).attach('avatar', A_PNG, {
      filename: 'avatar.png',
      contentType: 'image/png',
    });

    expect(fakeUserStorageProvider.delete).toHaveBeenCalledWith('avatars/old');
  });
});

describe('When we upload an invalid avatar', () => {
  it('should return 422 INVALID_AVATAR_TYPE for a GIF', async () => {
    const userId = await createUser();

    const { body, statusCode } = await uploadAvatar(userId).attach(
      'avatar',
      Buffer.from('GIF89a'),
      { filename: 'avatar.gif', contentType: 'image/gif' },
    );

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_AVATAR_TYPE');
    expect(fakeUserStorageProvider.upload).not.toHaveBeenCalled();
  });

  it('should return 413 for a file bigger than 5 MB', async () => {
    const userId = await createUser();

    const { statusCode } = await uploadAvatar(userId).attach(
      'avatar',
      Buffer.alloc(6 * 1024 * 1024),
      { filename: 'avatar.png', contentType: 'image/png' },
    );

    expect(statusCode).toBe(413);
  });

  it('should return 400 when avatar is a text field', async () => {
    const userId = await createUser();

    const { body, statusCode } = await uploadAvatar(userId).field(
      'avatar',
      'not a file',
    );

    expect(statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe("When we upload another user's avatar", () => {
  it('should return 403 without storing anything', async () => {
    const userId = await createUser();

    const { statusCode } = await uploadAvatar(userId, newObjectId()).attach(
      'avatar',
      A_PNG,
      { filename: 'avatar.png', contentType: 'image/png' },
    );

    expect(statusCode).toBe(403);
    expect(fakeUserStorageProvider.upload).not.toHaveBeenCalled();
  });
});

describe('When we remove our avatar', () => {
  it('should return 200 without the avatar, unset it and delete the file', async () => {
    const userId = await createUser({
      avatarUrl: 'https://cdn.example.com/avatars/old.png',
      avatarPublicId: 'avatars/old',
    });

    const { body, statusCode } = await removeAvatar(userId);

    expect(statusCode).toBe(200);
    expect(body).not.toHaveProperty('avatarUrl');
    expect(fakeUserStorageProvider.delete).toHaveBeenCalledWith('avatars/old');
    const inDb = await Muser.findById(userId).lean();
    expect(inDb).not.toHaveProperty('avatarUrl');
    expect(inDb).not.toHaveProperty('avatarPublicId');
  });

  it('should return 200 and change nothing when there is no avatar', async () => {
    const userId = await createUser();

    const { statusCode } = await removeAvatar(userId);

    expect(statusCode).toBe(200);
    expect(fakeUserStorageProvider.delete).not.toHaveBeenCalled();
  });
});
