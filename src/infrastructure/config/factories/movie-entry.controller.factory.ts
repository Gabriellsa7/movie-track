import { MovieEntryController } from '../../../interfaces/http/controllers/movie-entry.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { authenticate } from '../../../interfaces/http/middlewares/auth.middleware';
import { MovieEntryServiceFactory } from './movie-entry.service.factory';
import { TokenProviderFactory } from './token.provider.factory';

export class MovieEntryControllerFactory {
  static create(): IController {
    return new MovieEntryController(
      MovieEntryServiceFactory.create(),
      authenticate(TokenProviderFactory.create()),
    );
  }
}
