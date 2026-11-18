import { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_LANGUAGE,
  ELanguage,
} from '../../../domain/common/language';

declare module 'express-serve-static-core' {
  interface Request {
    language: ELanguage;
  }
}

// Only the first preference counts: the app sends a single language, and browsers list theirs in order.
export function languageFrom(header: string | undefined): ELanguage {
  const preferred = header?.split(',')[0]?.trim().toLowerCase() ?? '';
  return preferred.startsWith('pt') ? ELanguage.PT_BR : DEFAULT_LANGUAGE;
}

export function languageMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  req.language = languageFrom(req.headers['accept-language']);
  next();
}
