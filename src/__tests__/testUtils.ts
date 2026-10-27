import { Types } from 'mongoose';
import { MongooseDatabase } from '../../jest/setup-db';
import { TokenProviderFactory } from '../infrastructure/config/factories/token.provider.factory';
import { Muser } from '../infrastructure/db/mongo/models/user.model';
import { app } from './configApp';

export async function bootstrapTest() {
  const DATABASE_URI = String(process.env.DATABASE_URI || '');
  const DB_NAME = String(process.env.MONGODB_DATABASE);
  const dbInstance = new MongooseDatabase(DATABASE_URI, DB_NAME);

  await dbInstance.start();

  return {
    dbInstance,
    app,
  };
}

export function authHeaderFor(userId: string): string {
  const accessToken = TokenProviderFactory.create().generateAccessToken({
    sub: userId,
  });
  return `Bearer ${accessToken}`;
}

// Creating movies and watchlist items requires the token's user to exist.
export async function ensureUserExists(userId: string): Promise<void> {
  const now = new Date();
  await Muser.updateOne(
    { _id: userId },
    {
      $setOnInsert: {
        name: 'Test user',
        normalizedName: 'test user',
        email: `user-${userId}@email.com`,
        passwordHash: 'hashed-secret123',
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

export function newObjectId(): string {
  return new Types.ObjectId().toString();
}
