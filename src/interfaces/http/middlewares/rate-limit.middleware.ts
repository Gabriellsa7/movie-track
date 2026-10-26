import { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { TooManyRequestsError } from '../../../domain/errors/too-many-requests.error';

export interface IParamsLoginRateLimit {
  windowMilliseconds: number;
  maxFailuresPerAccount: number;
  maxFailuresPerIp: number;
}

function tooManyAttempts(): RequestHandler {
  return (_req, _res, next) =>
    next(
      new TooManyRequestsError(
        'Too many failed login attempts, try again later',
        'TOO_MANY_ATTEMPTS',
      ),
    );
}

// Only failed attempts count. Per account (IP + e-mail) stops guessing one password;
// per IP, with a looser limit, stops trying many e-mails. The store is in memory, per instance.
export function loginRateLimit({
  windowMilliseconds,
  maxFailuresPerAccount,
  maxFailuresPerIp,
}: IParamsLoginRateLimit): RequestHandler[] {
  const common = {
    windowMs: windowMilliseconds,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    handler: tooManyAttempts(),
  };
  return [
    rateLimit({
      ...common,
      limit: maxFailuresPerIp,
      identifier: 'login-ip',
      keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    }),
    rateLimit({
      ...common,
      limit: maxFailuresPerAccount,
      identifier: 'login-account',
      keyGenerator: (req) =>
        `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '')
          .trim()
          .toLowerCase()}`,
    }),
  ];
}
