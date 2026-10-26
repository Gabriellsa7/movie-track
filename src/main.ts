import './infrastructure/telemetry/tracing';
import path from 'path';
import { Logger } from 'traceability';
import { Server } from './interfaces/http/server';
import { env } from './infrastructure/config/env';

import { UserControllerFactory } from './infrastructure/config/factories/user.controller.factory';
import { AuthControllerFactory } from './infrastructure/config/factories/auth.controller.factory';
import { GenreControllerFactory } from './infrastructure/config/factories/genre.controller.factory';
import { GenreSeedFactory } from './infrastructure/config/factories/genre.seed.factory';
import { MovieEntryControllerFactory } from './infrastructure/config/factories/movie-entry.controller.factory';

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  './contracts/service.yaml',
);

const SHUTDOWN_TIMEOUT_MILLISECONDS = 10000;

const app = new Server({
  port: env.port,
  controllers: [
    UserControllerFactory.create(),
    AuthControllerFactory.create(),
    GenreControllerFactory.create(),
    MovieEntryControllerFactory.create(),
  ],
  databaseURI: env.databaseUri,
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});

async function start() {
  await app.databaseSetup();
  await GenreSeedFactory.create().run();
  const httpServer = app.listen();

  const shutdown = (signal: string) => {
    Logger.info(`Received ${signal}, shutting down gracefully`, {
      eventName: 'app.shutdown',
      process: 'Application',
    });
    httpServer.close(async () => {
      await app.closeDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MILLISECONDS).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  Logger.error((error as Error).message, {
    eventName: 'app.bootstrap_error',
    stack: (error as Error).stack,
  });
  process.exit(1);
});
