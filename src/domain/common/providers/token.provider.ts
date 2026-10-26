export interface ITokenPayload {
  sub: string;
  // Only in refresh tokens: changing the password bumps the user's version and revokes older tokens.
  sessionVersion?: number;
}

export interface ITokenProvider {
  generateAccessToken(payload: ITokenPayload): string;
  verifyAccessToken(token: string): ITokenPayload;
  generateRefreshToken(payload: ITokenPayload): string;
  verifyRefreshToken(token: string): ITokenPayload;
}
