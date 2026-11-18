const DEFAULT_BCRYPT_ROUNDS = 10;
const DEFAULT_JWT_EXPIRES_IN = '1h';
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = '7d';
// Resend's shared sender works without a domain, but only delivers to the account owner's address.
const DEFAULT_EMAIL_FROM = 'Movie Track <onboarding@resend.dev>';
const DEFAULT_APP_URL = 'http://localhost:5173';

function parseList(value: string | undefined): Array<string> {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  // How many proxies sit in front of the app; req.ip (and the login rate limit) depends on it.
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS) || 0,
  databaseUri: requireEnv('DATABASE_URI'),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || DEFAULT_BCRYPT_ROUNDS,
  jwtSecret: requireEnv('JWT_SECRET'),
  refreshTokenSecret: requireEnv('REFRESH_TOKEN_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN,
  refreshTokenExpiresIn:
    process.env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
  // Optional: without them the server still boots, but uploads answer 503 STORAGE_UNAVAILABLE.
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || undefined,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || undefined,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || undefined,
  // Optional: without it the movie search answers 503 MOVIE_CATALOG_UNAVAILABLE.
  tmdbAccessToken: process.env.TMDB_ACCESS_TOKEN || undefined,
  // Where the front-end runs; e-mail links point to its /verify-email and /reset-password pages.
  appUrl: process.env.APP_URL || DEFAULT_APP_URL,
  // Browser origins allowed by CORS, comma-separated; defaults to APP_URL. Native apps don't need it.
  corsOrigins: parseList(
    process.env.CORS_ORIGINS || process.env.APP_URL || DEFAULT_APP_URL,
  ),
  // Optional: without it e-mails are logged instead of sent (see LogAccountMailer).
  resendApiKey: process.env.RESEND_API_KEY || undefined,
  emailFrom: process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM,
};
