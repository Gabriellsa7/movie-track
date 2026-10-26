import jwt from 'jsonwebtoken';
import { BcryptPasswordHasher } from '../../infrastructure/providers/password-hasher/bcrypt.password-hasher';
import { SystemClock } from '../../infrastructure/providers/clock/system.clock';
import { JwtTokenProvider } from '../../infrastructure/providers/token/jwt.token-provider';
import {
  CloudinaryStorageProvider,
  ICloudinaryUploader,
} from '../../infrastructure/providers/storage/cloudinary.storage-provider';

const LOW_COST_ROUNDS = 4;

describe('When we hash a password with bcrypt', () => {
  const passwordHasher = new BcryptPasswordHasher(LOW_COST_ROUNDS);

  it('should never return the plain password', async () => {
    const passwordHash = await passwordHasher.hash('secret123');

    expect(passwordHash).not.toBe('secret123');
    expect(passwordHash).toMatch(/^\$2[aby]\$04\$/);
  });

  it('should match only the original password', async () => {
    const passwordHash = await passwordHasher.hash('secret123');

    await expect(
      passwordHasher.compare('secret123', passwordHash),
    ).resolves.toBe(true);
    await expect(
      passwordHasher.compare('wrong123', passwordHash),
    ).resolves.toBe(false);
  });
});

describe('When we read the system clock', () => {
  it('should return the current date', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('When we sign and verify tokens with JWT', () => {
  const tokenProvider = new JwtTokenProvider({
    accessTokenSecret: 'access-secret',
    accessTokenExpiresIn: '1h',
    refreshTokenSecret: 'refresh-secret',
    refreshTokenExpiresIn: '7d',
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return the subject of a valid access token', () => {
    const token = tokenProvider.generateAccessToken({ sub: 'user-id' });

    expect(tokenProvider.verifyAccessToken(token)).toEqual({ sub: 'user-id' });
  });

  it('should return the subject of a valid refresh token', () => {
    const token = tokenProvider.generateRefreshToken({ sub: 'user-id' });

    expect(tokenProvider.verifyRefreshToken(token)).toEqual({ sub: 'user-id' });
  });

  it('should reject a refresh token used as an access token', () => {
    const refreshToken = tokenProvider.generateRefreshToken({ sub: 'user-id' });

    expect(() => tokenProvider.verifyAccessToken(refreshToken)).toThrow(
      'Invalid token',
    );
  });

  it('should reject a tampered token', () => {
    const token = tokenProvider.generateAccessToken({ sub: 'user-id' });
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'another-user' }),
    ).toString('base64url');

    expect(() =>
      tokenProvider.verifyAccessToken(
        `${header}.${forgedPayload}.${signature}`,
      ),
    ).toThrow('Invalid token');
  });

  it('should reject a correctly signed token without a subject', () => {
    const tokenWithoutSubject = jwt.sign({ role: 'admin' }, 'access-secret');

    expect(() => tokenProvider.verifyAccessToken(tokenWithoutSubject)).toThrow(
      'Invalid token',
    );
  });

  it('should reject an expired access token', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = tokenProvider.generateAccessToken({ sub: 'user-id' });

    jest.setSystemTime(new Date('2026-01-01T02:00:00Z'));

    expect(() => tokenProvider.verifyAccessToken(token)).toThrow(
      'Token expired',
    );
  });
});

describe('When we store files in Cloudinary', () => {
  const upload = jest.fn();
  const destroy = jest.fn();
  const storageProvider = new CloudinaryStorageProvider({
    upload,
    destroy,
  } as unknown as ICloudinaryUploader);

  beforeEach(() => {
    upload.mockReset();
    destroy.mockReset();
  });

  it('should upload the image to the folder and return its url and public id', async () => {
    upload.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/posters/abc.png',
      public_id: 'posters/abc',
    });

    const storedFile = await storageProvider.upload({
      buffer: Buffer.from('image'),
      mimeType: 'image/png',
      folder: 'posters',
    });

    expect(upload).toHaveBeenCalledWith(
      `data:image/png;base64,${Buffer.from('image').toString('base64')}`,
      { folder: 'posters', resource_type: 'image' },
    );
    expect(storedFile).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/posters/abc.png',
      publicId: 'posters/abc',
    });
  });

  it('should delete the image by its public id and purge the cdn cache', async () => {
    destroy.mockResolvedValue({ result: 'ok' });

    await storageProvider.delete('posters/old');

    expect(destroy).toHaveBeenCalledWith('posters/old', {
      resource_type: 'image',
      invalidate: true,
    });
  });

  it('should propagate storage failures', async () => {
    upload.mockRejectedValue(new Error('Cloudinary down'));

    await expect(
      storageProvider.upload({
        buffer: Buffer.from('image'),
        mimeType: 'image/webp',
        folder: 'posters',
      }),
    ).rejects.toThrow('Cloudinary down');
  });
});
