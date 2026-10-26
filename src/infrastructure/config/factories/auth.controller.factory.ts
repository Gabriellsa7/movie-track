import { AuthController } from '../../../interfaces/http/controllers/auth.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { loginRateLimit } from '../../../interfaces/http/middlewares/rate-limit.middleware';
import { AuthServiceFactory } from './auth.service.factory';

const LOGIN_RATE_LIMIT_WINDOW_MILLISECONDS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES_PER_ACCOUNT = 5;
const MAX_LOGIN_FAILURES_PER_IP = 50;

export class AuthControllerFactory {
  static create(): IController {
    return new AuthController(
      AuthServiceFactory.create(),
      loginRateLimit({
        windowMilliseconds: LOGIN_RATE_LIMIT_WINDOW_MILLISECONDS,
        maxFailuresPerAccount: MAX_LOGIN_FAILURES_PER_ACCOUNT,
        maxFailuresPerIp: MAX_LOGIN_FAILURES_PER_IP,
      }),
    );
  }
}
