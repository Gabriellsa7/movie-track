import express, {
  Request,
  Response,
  Application,
  RequestHandler,
} from 'express';
import { ContextAsyncHooks, Logger } from 'traceability';
import { Server as httpServer } from 'http';
import { IController } from './controllers/controller.interface';
import mongoose from 'mongoose';
import * as OpenApiValidator from 'express-openapi-validator';
import helmet from 'helmet';
import cors from 'cors';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import swaggerUi, { JsonObject } from 'swagger-ui-express';
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware';

const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
// Without them in the exposed list, browser code can't read how long to wait after a 429.
const CORS_EXPOSED_HEADERS = ['RateLimit', 'RateLimit-Policy', 'Retry-After'];

export class Server {
  public app: Application;

  public port: number;

  public apiSpecLocation?: string;

  public DATABASE_URI?: string;

  private readonly timeoutMilliseconds?: number;

  private readonly defaultMiddlewares = [
    express.json({ limit: '3mb' }),
    express.urlencoded({ limit: '3mb', extended: true }),
    ContextAsyncHooks.getExpressMiddlewareTracking(),
    helmet(),
  ];
  constructor(appInit: {
    port: number;
    middlewaresToStart?: Array<RequestHandler>;
    controllers?: Array<IController>;
    apiSpecLocation?: string;
    databaseURI?: string;
    timeoutMilliseconds?: number;
    trustProxyHops?: number;
    corsOrigins?: Array<string>;
  }) {
    this.app = express();
    this.app.set('trust proxy', appInit.trustProxyHops ?? 0);
    // First, so preflight requests are answered before the contract validator rejects OPTIONS.
    this.app.use(
      cors({
        origin: appInit.corsOrigins ?? [],
        exposedHeaders: CORS_EXPOSED_HEADERS,
      }),
    );
    this.port = appInit.port;
    this.apiSpecLocation = appInit.apiSpecLocation;
    this.DATABASE_URI = appInit.databaseURI;
    this.timeoutMilliseconds = appInit.timeoutMilliseconds;

    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'OK' });
    });

    // Before the validator and helmet: /docs is not in the contract, and helmet's CSP would block the UI.
    if (this.apiSpecLocation) {
      const apiSpec = load(
        readFileSync(this.apiSpecLocation, 'utf8'),
      ) as JsonObject;
      this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(apiSpec));
    }

    this.middlewares([
      ...this.defaultMiddlewares,
      ...(appInit.middlewaresToStart || []),
    ]);

    this.routes(appInit.controllers || []);

    this.errorHandler();
  }

  private middlewares(middleWares: Array<RequestHandler>) {
    middleWares.forEach((middleWare) => this.app.use(middleWare));
    this.app.use(
      OpenApiValidator.middleware({
        apiSpec: this.apiSpecLocation || '',
        validateApiSpec: true,
        validateResponses: true,
        fileUploader: { limits: { fileSize: MAX_UPLOAD_FILE_BYTES, files: 1 } },
      }),
    );
  }

  private errorHandler() {
    this.app.use(errorHandlerMiddleware);
  }

  private routes(controllers: Array<IController>, pathRoute = '/') {
    controllers.forEach((controller) =>
      this.app.use(pathRoute, controller.getRoutes()),
    );
  }

  public async databaseSetup() {
    if (!this.DATABASE_URI) {
      throw new Error('Database URI not provided');
    }
    mongoose.connection.once('connected', () => {
      Logger.info('Connected to MongoDB', { eventName: 'database.connected' });
    });
    mongoose.connection?.on('error', (err) => {
      Logger.error(`Error connecting to MongoDB: ${err.message}`, {
        eventName: 'database.connection_error',
      });
    });
    await mongoose.connect(this.DATABASE_URI);
  }

  public async closeDatabase() {
    mongoose.connection.once('disconnected', () => {
      Logger.info('Mongoose disconnected', {
        eventName: 'database.disconnected',
      });
    });
    await mongoose.disconnect();
  }

  public listen(): httpServer {
    return this.app
      .listen(this.port, () => {
        Logger.info(`App listening on the http://localhost:${this.port}`, {
          eventName: 'start_listening',
          process: 'Application',
        });
      })
      .setTimeout(this.timeoutMilliseconds || 30000);
  }
}
