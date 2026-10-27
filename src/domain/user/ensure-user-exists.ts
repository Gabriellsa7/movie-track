import { UnauthorizedError } from '../errors/unauthorized.error';
import { IUserRepositoryRead } from './repository/user.repository.read';

// Access tokens are stateless and outlive a deleted account (up to JWT_EXPIRES_IN), so
// creating data checks the account still exists instead of leaving rows nobody can reach.
export async function ensureUserExists(
  userRepositoryRead: IUserRepositoryRead,
  userId: string,
): Promise<void> {
  const user = await userRepositoryRead.findUserById(userId);
  if (!user) {
    throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
  }
}
