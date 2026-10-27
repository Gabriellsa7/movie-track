import { createHash, randomBytes } from 'crypto';
import {
  ISecureToken,
  ISecureTokenProvider,
} from '../../../domain/common/providers/secure-token.provider';

const TOKEN_BYTES = 32;

export class CryptoSecureTokenProvider implements ISecureTokenProvider {
  generate(): ISecureToken {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  // 256 random bits need no slow hash like bcrypt: SHA-256 is enough to make a leaked hash useless.
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
