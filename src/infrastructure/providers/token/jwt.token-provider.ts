import jwt, { JwtPayload, SignOptions, TokenExpiredError } from 'jsonwebtoken';
import {
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
    );
  }

  verifyRefreshToken(token: string): ITokenPayload {
    return this.verify(token, this.params.refreshTokenSecret);
  }

  private sign(
    payload: ITokenPayload,
    secret: string,
    expiresIn: string,
  ): string {
    const claims =
      payload.sessionVersion === undefined
        ? { sub: payload.sub }
        : { sub: payload.sub, ver: payload.sessionVersion };
    return jwt.sign(claims, secret, {
      algorithm: ALGORITHM,
      // jsonwebtoken types only accept ms-format literals ('1h', '7d'); an invalid env value fails at sign time
      expiresIn: expiresIn as SignOptions['expiresIn'],
    });
  }

  private verify(token: string, secret: string): ITokenPayload {
    let decoded: string | JwtPayload;
    try {
      decoded = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
      }
      throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
    }

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
    }
    return typeof decoded.ver === 'number'
      ? { sub: decoded.sub, sessionVersion: decoded.ver }
      : { sub: decoded.sub };
  }
}
