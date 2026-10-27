import { IRevokedTokenRepositoryRead } from '../../../domain/auth/repository/revoked-token.repository.read';
import { MrevokedToken } from '../../db/mongo/models/revoked-token.model';

export class RevokedTokenRepositoryRead implements IRevokedTokenRepositoryRead {
  async isTokenRevoked(tokenId: string): Promise<boolean> {
    return (await MrevokedToken.exists({ tokenId })) !== null;
  }
}
