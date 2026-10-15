import { BcryptPasswordHasher } from '../../infrastructure/providers/password-hasher/bcrypt.password-hasher';
import { SystemClock } from '../../infrastructure/providers/clock/system.clock';

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

    await expect(passwordHasher.compare('secret123', passwordHash)).resolves.toBe(
      true,
    );
    await expect(passwordHasher.compare('wrong123', passwordHash)).resolves.toBe(
      false,
    );
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
