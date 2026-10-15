import { UserController } from '../../../interfaces/http/controllers/user.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { UserServiceFactory } from './user.service.factory';
import { TokenProviderFactory } from './token.provider.factory';
import { authenticate } from '../../../interfaces/http/middlewares/auth.middleware';

export class UserControllerFactory {
  static create(): IController {
    return new UserController(
      UserServiceFactory.create(),
      authenticate(TokenProviderFactory.create()),
    );
  }
}
