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
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware';

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
  }) {
    this.app = express();
    this.port = appInit.port;
    this.apiSpecLocation = appInit.apiSpecLocation;
    this.DATABASE_URI = appInit.databaseURI;
    this.timeoutMilliseconds = appInit.timeoutMilliseconds;

    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'OK' });
    });

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
