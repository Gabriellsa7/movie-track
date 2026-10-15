import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import { IController } from './controller.interface';
import { IUserService } from '../../../domain/user/interfaces/user.service.interface';
import { authorizeSelf } from '../middlewares/auth.middleware';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_LIMIT = 20;

export class UserController implements IController {
  router: Router;
  private readonly userService: IUserService;
  private readonly authenticate: RequestHandler;

  constructor(userService: IUserService, authenticate: RequestHandler) {
    this.userService = userService;
    this.authenticate = authenticate;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.get('/users', this.getUsers);
    this.router.get('/users/:id', this.getUserProfile);
    this.router.post('/users', this.createUser);
    this.router.put(
      '/users/:id',
      this.authenticate,
      authorizeSelf,
      this.updateUser,
    );
    this.router.patch(
      '/users/:id/password',
      this.authenticate,
      authorizeSelf,
      this.changePassword,
    );
    this.router.delete(
      '/users/:id',
      this.authenticate,
      authorizeSelf,
      this.deleteUser,
    );
  }

  getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const {
      search,
      page = DEFAULT_PAGE,
      limit = DEFAULT_PAGE_LIMIT,
    } = req.query as { search?: string; page?: number; limit?: number };
    try {
      const users = await this.userService.listPublicUsers({
        search,
        pagination: { limit, offset: (page - 1) * limit },
      });
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  };

  getUserProfile = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const profile = await this.userService.getPublicProfile(req.params.id);
      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  };

  createUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { name, email, password } = req.body;
    try {
      const newUser = await this.userService.createUser({
        name,
        email,
        password,
      });
      res.status(201).json(newUser);
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { name, email } = req.body;
    try {
      const updatedUser = await this.userService.updateUserById({
        id: req.params.id,
        userData: { name, email },
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    try {
      await this.userService.changePassword({
        id: req.params.id,
        currentPassword,
        newPassword,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.userService.deleteUser({
        id: req.params.id,
        password: req.body.password,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  public getRoutes(): Router {
    return this.router;
  }
}
