import { AppLinkController } from '../../../interfaces/http/controllers/app-link.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { env } from '../env';

export class AppLinkControllerFactory {
  static create(): IController {
    return new AppLinkController(env.appDeepLinkUrl);
  }
}
