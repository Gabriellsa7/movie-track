const DEFAULT_BCRYPT_ROUNDS = 10;
const DEFAULT_JWT_EXPIRES_IN = '1h';
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = '7d';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUri: requireEnv('DATABASE_URI'),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || DEFAULT_BCRYPT_ROUNDS,
  jwtSecret: requireEnv('JWT_SECRET'),
  refreshTokenSecret: requireEnv('REFRESH_TOKEN_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN,
  refreshTokenExpiresIn:
    process.env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
  cloudinaryCloudName: requireEnv('CLOUDINARY_CLOUD_NAME'),
  cloudinaryApiKey: requireEnv('CLOUDINARY_API_KEY'),
  cloudinaryApiSecret: requireEnv('CLOUDINARY_API_SECRET'),
};
