export interface ITokenPayload {
  sub: string;
}

export interface ITokenProvider {
  generateAccessToken(payload: ITokenPayload): string;
  verifyAccessToken(token: string): ITokenPayload;
  generateRefreshToken(payload: ITokenPayload): string;
  verifyRefreshToken(token: string): ITokenPayload;
}
