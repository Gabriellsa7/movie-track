import { UserController } from '../../../interfaces/http/controllers/user.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { UserServiceFactory } from './user.service.factory';
import { TokenProviderFactory } from './token.provider.factory';
import { authenticate } from '../../../interfaces/http/middlewares/auth.middleware';
import { requestRateLimit } from '../../../interfaces/http/middlewares/rate-limit.middleware';

const EMAIL_VERIFICATION_WINDOW_MILLISECONDS = 60 * 60 * 1000;
const MAX_EMAIL_VERIFICATION_REQUESTS = 3;

export class UserControllerFactory {
  static create(): IController {
    return new UserController(
      UserServiceFactory.create(),
      authenticate(TokenProviderFactory.create()),
      requestRateLimit({
        windowMilliseconds: EMAIL_VERIFICATION_WINDOW_MILLISECONDS,
        limit: MAX_EMAIL_VERIFICATION_REQUESTS,
        identifier: 'email-verification',
        key: (req) => req.userId ?? '',
      }),
    );
  }
}
