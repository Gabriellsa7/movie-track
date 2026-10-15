import { AuthController } from '../../../interfaces/http/controllers/auth.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { AuthServiceFactory } from './auth.service.factory';

export class AuthControllerFactory {
  static create(): IController {
    return new AuthController(AuthServiceFactory.create());
  }
}
