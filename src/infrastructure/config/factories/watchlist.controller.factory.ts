import { WatchlistController } from '../../../interfaces/http/controllers/watchlist.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { authenticate } from '../../../interfaces/http/middlewares/auth.middleware';
import { WatchlistServiceFactory } from './watchlist.service.factory';
import { TokenProviderFactory } from './token.provider.factory';

export class WatchlistControllerFactory {
  static create(): IController {
    return new WatchlistController(
      WatchlistServiceFactory.create(),
      authenticate(TokenProviderFactory.create()),
    );
  }
}
