import { IRevokedToken } from '../interfaces/revoked-token.interface';

export interface IRevokedTokenRepositoryWrite {
  revokeToken(revokedToken: IRevokedToken): Promise<void>;
}
