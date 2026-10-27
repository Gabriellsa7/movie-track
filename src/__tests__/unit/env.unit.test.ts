const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('When we load the environment configuration', () => {
  it('should expose the values when required variables are set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
      PORT: '4000',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.databaseUri).toBe('mongodb://localhost/test');
      expect(env.port).toBe(4000);
    });
  });

  it('should fall back to port 3000 when PORT is not set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
    };
    delete process.env.PORT;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.port).toBe(3000);
    });
  });

  it('should use 10 bcrypt rounds when BCRYPT_ROUNDS is not set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
    };
    delete process.env.BCRYPT_ROUNDS;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.bcryptRounds).toBe(10);
    });
  });

  it('should read the bcrypt rounds from BCRYPT_ROUNDS', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
      BCRYPT_ROUNDS: '12',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.bcryptRounds).toBe(12);
    });
  });

  it('should trust no proxy unless TRUST_PROXY_HOPS is set', () => {
    process.env = { ...ORIGINAL_ENV, DATABASE_URI: 'mongodb://localhost/test' };
    delete process.env.TRUST_PROXY_HOPS;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.trustProxyHops).toBe(0);
    });
  });

  it('should read the proxy hops from TRUST_PROXY_HOPS', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
      TRUST_PROXY_HOPS: '1',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.trustProxyHops).toBe(1);
    });
  });

  it('should log e-mails when RESEND_API_KEY is not set and use the default sender', () => {
    process.env = { ...ORIGINAL_ENV, DATABASE_URI: 'mongodb://localhost/test' };
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.resendApiKey).toBeUndefined();
      expect(env.emailFrom).toBe('Movie Track <onboarding@resend.dev>');
    });
  });

  it('should allow only APP_URL by CORS when CORS_ORIGINS is not set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
      APP_URL: 'http://localhost:5173',
    };
    delete process.env.CORS_ORIGINS;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.corsOrigins).toEqual(['http://localhost:5173']);
    });
  });

  it('should read the CORS origins from CORS_ORIGINS, ignoring blanks', () => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URI: 'mongodb://localhost/test',
      CORS_ORIGINS: 'http://localhost:5173, https://movie-track-web.vercel.app,',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.corsOrigins).toEqual([
        'http://localhost:5173',
        'https://movie-track-web.vercel.app',
      ]);
    });
  });

  it('should throw when APP_URL is missing', () => {
    process.env = { ...ORIGINAL_ENV, DATABASE_URI: 'mongodb://localhost/test' };
    delete process.env.APP_URL;

    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../infrastructure/config/env'),
      ).toThrow('Missing required environment variable: APP_URL');
    });
  });

  it('should throw naming the missing required variable', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DATABASE_URI;

    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../infrastructure/config/env'),
      ).toThrow('Missing required environment variable: DATABASE_URI');
    });
  });

  it('should use 1h as the JWT expiration when JWT_EXPIRES_IN is not set', () => {
    process.env = { ...ORIGINAL_ENV, DATABASE_URI: 'mongodb://localhost/test' };
    delete process.env.JWT_EXPIRES_IN;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.jwtExpiresIn).toBe('1h');
    });
  });

  it('should throw when JWT_SECRET is missing', () => {
    process.env = { ...ORIGINAL_ENV, DATABASE_URI: 'mongodb://localhost/test' };
    delete process.env.JWT_SECRET;

    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../infrastructure/config/env'),
      ).toThrow('Missing required environment variable: JWT_SECRET');
    });
  });

  it('should use 7d as the refresh token expiration when REFRESH_TOKEN_EXPIRES_IN is not set', () => {
    process.env = { ...ORIGINAL_ENV, DATABASE_URI: 'mongodb://localhost/test' };
    delete process.env.REFRESH_TOKEN_EXPIRES_IN;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { env } = require('../../infrastructure/config/env');
      expect(env.refreshTokenExpiresIn).toBe('7d');
    });
  });

  it('should throw when REFRESH_TOKEN_SECRET is missing', () => {
    process.env = { ...ORIGINAL_ENV, DATABASE_URI: 'mongodb://localhost/test' };
    delete process.env.REFRESH_TOKEN_SECRET;

    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../infrastructure/config/env'),
      ).toThrow('Missing required environment variable: REFRESH_TOKEN_SECRET');
    });
  });
});
