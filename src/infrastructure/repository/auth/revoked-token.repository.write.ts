import { IRevokedToken } from '../../../domain/auth/interfaces/revoked-token.interface';
import { IRevokedTokenRepositoryWrite } from '../../../domain/auth/repository/revoked-token.repository.write';
import { MrevokedToken } from '../../db/mongo/models/revoked-token.model';

export class RevokedTokenRepositoryWrite implements IRevokedTokenRepositoryWrite {
  // An upsert, so logging out twice with the same token is not an error.
  async revokeToken({ tokenId, expiresAt }: IRevokedToken): Promise<void> {
    await MrevokedToken.updateOne(
      { tokenId },
      { $setOnInsert: { tokenId, expiresAt } },
      { upsert: true },
    );
  }
}
