export interface IRevokedToken {
  tokenId: string;
  // Past this date the token is expired anyway, so the entry can be dropped.
  expiresAt: Date;
}
