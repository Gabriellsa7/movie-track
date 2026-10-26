import { MovieSearchController } from '../../../interfaces/http/controllers/movie-search.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { authenticate } from '../../../interfaces/http/middlewares/auth.middleware';
import { MovieSearchServiceFactory } from './movie-search.service.factory';
import { TokenProviderFactory } from './token.provider.factory';

export class MovieSearchControllerFactory {
  static create(): IController {
    return new MovieSearchController(
      MovieSearchServiceFactory.create(),
      authenticate(TokenProviderFactory.create()),
    );
  }
}
