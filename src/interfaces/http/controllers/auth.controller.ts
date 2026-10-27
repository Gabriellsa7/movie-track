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
  private readonly passwordResetRateLimit: RequestHandler;

  constructor(
    authService: IAuthService,
    loginRateLimit: RequestHandler[],
    passwordResetRateLimit: RequestHandler,
  ) {
    this.authService = authService;
    this.loginRateLimit = loginRateLimit;
    this.passwordResetRateLimit = passwordResetRateLimit;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.post('/auth/login', ...this.loginRateLimit, this.login);
    this.router.post('/auth/refresh', this.refresh);
    this.router.post('/auth/verify-email', this.verifyEmail);
    this.router.post(
      '/auth/forgot-password',
      this.passwordResetRateLimit,
      this.forgotPassword,
    );
    this.router.post('/auth/reset-password', this.resetPassword);
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

  verifyEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.authService.verifyEmail(req.body.token);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.authService.requestPasswordReset(req.body.email);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { token, newPassword } = req.body;
    try {
      await this.authService.resetPassword({ token, newPassword });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getRoutes(): Router {
    return this.router;
  }
}
