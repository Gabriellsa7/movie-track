export interface IRevokedTokenRepositoryRead {
  isTokenRevoked(tokenId: string): Promise<boolean>;
}
