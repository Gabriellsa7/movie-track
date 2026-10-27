import { AuthController } from '../../../interfaces/http/controllers/auth.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import {
  byIp,
  loginRateLimit,
  requestRateLimit,
} from '../../../interfaces/http/middlewares/rate-limit.middleware';
import { AuthServiceFactory } from './auth.service.factory';

const LOGIN_RATE_LIMIT_WINDOW_MILLISECONDS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES_PER_ACCOUNT = 5;
const MAX_LOGIN_FAILURES_PER_IP = 50;
const PASSWORD_RESET_WINDOW_MILLISECONDS = 15 * 60 * 1000;
const MAX_PASSWORD_RESET_REQUESTS_PER_IP = 5;

export class AuthControllerFactory {
  static create(): IController {
    return new AuthController(
      AuthServiceFactory.create(),
      loginRateLimit({
        windowMilliseconds: LOGIN_RATE_LIMIT_WINDOW_MILLISECONDS,
        maxFailuresPerAccount: MAX_LOGIN_FAILURES_PER_ACCOUNT,
        maxFailuresPerIp: MAX_LOGIN_FAILURES_PER_IP,
      }),
      requestRateLimit({
        windowMilliseconds: PASSWORD_RESET_WINDOW_MILLISECONDS,
        limit: MAX_PASSWORD_RESET_REQUESTS_PER_IP,
        identifier: 'password-reset',
        key: byIp,
      }),
    );
  }
}
