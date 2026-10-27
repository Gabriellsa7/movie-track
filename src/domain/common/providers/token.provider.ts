export interface ITokenPayload {
  sub: string;
  // Only in refresh tokens: changing the password bumps the user's version and revokes older tokens.
  sessionVersion?: number;
}

export interface IRefreshTokenClaims extends ITokenPayload {
  // Unique per refresh token, so a logout can revoke just that one.
  tokenId: string;
  expiresAt: Date;
}

export interface ITokenProvider {
  generateAccessToken(payload: ITokenPayload): string;
  verifyAccessToken(token: string): ITokenPayload;
  generateRefreshToken(payload: ITokenPayload): string;
  verifyRefreshToken(token: string): IRefreshTokenClaims;
}
