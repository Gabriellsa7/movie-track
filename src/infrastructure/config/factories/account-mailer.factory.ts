import { IAccountMailer } from '../../../domain/common/providers/account-mailer.provider';
import { LogAccountMailer } from '../../providers/account-mailer/log.account-mailer';
import { ResendAccountMailer } from '../../providers/account-mailer/resend.account-mailer';
import { env } from '../env';

export class AccountMailerFactory {
  static create(): IAccountMailer {
    if (!env.resendApiKey) {
      return new LogAccountMailer(env.appUrl);
    }
    return new ResendAccountMailer({
      apiKey: env.resendApiKey,
      from: env.emailFrom,
      appUrl: env.appUrl,
    });
  }
}
