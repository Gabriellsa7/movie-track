import path from 'path';
import { Server } from '../interfaces/http/server';
import { UserControllerFactory } from '../infrastructure/config/factories/user.controller.factory';
import { AuthControllerFactory } from '../infrastructure/config/factories/auth.controller.factory';
import { GenreControllerFactory } from '../infrastructure/config/factories/genre.controller.factory';
import { WatchlistControllerFactory } from '../infrastructure/config/factories/watchlist.controller.factory';

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../contracts/service.yaml',
);

export const app = new Server({
  port: Number(process.env.PORT) || 3000,
  controllers: [
    UserControllerFactory.create(),
    AuthControllerFactory.create(),
    GenreControllerFactory.create(),
    WatchlistControllerFactory.create(),
  ],
  databaseURI: process.env.DATABASE_URI,
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});
