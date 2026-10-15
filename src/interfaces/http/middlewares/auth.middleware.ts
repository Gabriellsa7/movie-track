import { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  ITokenPayload,
  ITokenProvider,
} from '../../../domain/common/providers/token.provider';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error';
import { ForbiddenError } from '../../../domain/errors/forbidden.error';

const BEARER_TOKEN_PATTERN = /^Bearer (\S+)$/i;

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export function authenticate(tokenProvider: ITokenProvider): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const match = req.headers.authorization?.match(BEARER_TOKEN_PATTERN);
    if (!match) {
      next(new UnauthorizedError('Missing bearer token', 'INVALID_TOKEN'));
      return;
    }

    let payload: ITokenPayload;
    try {
      payload = tokenProvider.verifyAccessToken(match[1]);
    } catch (error) {
      next(error);
      return;
    }

    req.userId = payload.sub;
    next();
  };
}

export const authorizeSelf: RequestHandler = (req, _res, next) => {
  if (!req.userId || req.userId !== req.params.id) {
    next(
      new ForbiddenError(
        'You can only change your own account',
        'FORBIDDEN_RESOURCE',
      ),
    );
    return;
  }
  next();
};
