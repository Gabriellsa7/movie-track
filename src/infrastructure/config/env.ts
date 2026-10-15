const DEFAULT_BCRYPT_ROUNDS = 10;

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
};
