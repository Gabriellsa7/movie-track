import { randomUUID } from 'crypto';
import jwt, { JwtPayload, SignOptions, TokenExpiredError } from 'jsonwebtoken';
import {
  IRefreshTokenClaims,
  ITokenPayload,
  ITokenProvider,
} from '../../../domain/common/providers/token.provider';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error';

const ALGORITHM = 'HS256';

export interface IParamsJwtTokenProvider {
  accessTokenSecret: string;
  accessTokenExpiresIn: string;
  refreshTokenSecret: string;
  refreshTokenExpiresIn: string;
}

export class JwtTokenProvider implements ITokenProvider {
  constructor(private readonly params: IParamsJwtTokenProvider) {}

  generateAccessToken(payload: ITokenPayload): string {
    return this.sign(
      payload,
      this.params.accessTokenSecret,
      this.params.accessTokenExpiresIn,
    );
  }

  verifyAccessToken(token: string): ITokenPayload {
    return this.verify(token, this.params.accessTokenSecret);
  }

  generateRefreshToken(payload: ITokenPayload): string {
    return this.sign(
      payload,
      this.params.refreshTokenSecret,
      this.params.refreshTokenExpiresIn,
      randomUUID(),
    );
  }

  verifyRefreshToken(token: string): IRefreshTokenClaims {
    const decoded = this.decode(token, this.params.refreshTokenSecret);
    // Refresh tokens issued before logout existed have no jti and could never be revoked.
    if (typeof decoded.jti !== 'string' || typeof decoded.exp !== 'number') {
      throw this.invalidTokenError();
    }
    return {
      ...this.toPayload(decoded),
      tokenId: decoded.jti,
      expiresAt: new Date(decoded.exp * 1000),
    };
  }

  private sign(
    payload: ITokenPayload,
    secret: string,
    expiresIn: string,
    tokenId?: string,
  ): string {
    const claims =
      payload.sessionVersion === undefined
        ? { sub: payload.sub }
        : { sub: payload.sub, ver: payload.sessionVersion };
    return jwt.sign(claims, secret, {
      algorithm: ALGORITHM,
      // jsonwebtoken types only accept ms-format literals ('1h', '7d'); an invalid env value fails at sign time
      expiresIn: expiresIn as SignOptions['expiresIn'],
      ...(tokenId && { jwtid: tokenId }),
    });
  }

  private verify(token: string, secret: string): ITokenPayload {
    return this.toPayload(this.decode(token, secret));
  }

  private decode(token: string, secret: string): JwtPayload {
    let decoded: string | JwtPayload;
    try {
      decoded = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
      }
      throw this.invalidTokenError();
    }

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw this.invalidTokenError();
    }
    return decoded;
  }

  private toPayload(decoded: JwtPayload): ITokenPayload {
    return typeof decoded.ver === 'number'
      ? { sub: decoded.sub!, sessionVersion: decoded.ver }
      : { sub: decoded.sub! };
  }

  private invalidTokenError(): UnauthorizedError {
    return new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
  }
}
