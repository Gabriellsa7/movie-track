import { randomBytes } from 'crypto';
import { Router, Request, Response } from 'express';
import { IController } from './controller.interface';
import { appDeepLink, appLinkPage } from './app-link.page';

interface IAppLinkQuery {
  token: string;
}

export class AppLinkController implements IController {
  router: Router;
  private readonly appDeepLinkUrl: string;

  constructor(appDeepLinkUrl: string) {
    this.appDeepLinkUrl = appDeepLinkUrl;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.get('/links/:action', this.openApp);
  }

  openApp = (req: Request<{ action: string }>, res: Response): void => {
    const { token } = req.query as unknown as IAppLinkQuery;
    const deepLink = appDeepLink(this.appDeepLinkUrl, req.params.action, token);
    const nonce = randomBytes(16).toString('base64');
    // The API-wide CSP blocks inline scripts; this page only needs its own redirect script.
    res
      .status(200)
      .set(
        'Content-Security-Policy',
        `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'`,
      )
      .type('html')
      .send(appLinkPage(deepLink, nonce));
  };

  public getRoutes(): Router {
    return this.router;
  }
}
