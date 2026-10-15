import { MongooseDatabase } from '../../jest/setup-db';
import { TokenProviderFactory } from '../infrastructure/config/factories/token.provider.factory';
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
