import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import { IController } from './controller.interface';
import { IAuthService } from '../../../domain/auth/interfaces/auth.service.interface';

export class AuthController implements IController {
  router: Router;
  private readonly authService: IAuthService;
  private readonly loginRateLimit: RequestHandler[];

  constructor(authService: IAuthService, loginRateLimit: RequestHandler[]) {
    this.authService = authService;
    this.loginRateLimit = loginRateLimit;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.post('/auth/login', ...this.loginRateLimit, this.login);
    this.router.post('/auth/refresh', this.refresh);
  }

  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { email, password } = req.body;
    try {
      const tokens = await this.authService.login({ email, password });
      res.status(200).json(tokens);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { refreshToken } = req.body;
    try {
      const tokens = await this.authService.refresh({ refreshToken });
      res.status(200).json(tokens);
    } catch (error) {
      next(error);
    }
  };

  getRoutes(): Router {
    return this.router;
  }
}
