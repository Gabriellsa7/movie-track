import { Logger } from 'traceability';
import {
  IAccountMailer,
  IParamsAccountEmail,
} from '../../../domain/common/providers/account-mailer.provider';
import { accountLink } from './account-emails';

// Used when RESEND_API_KEY is not set (local development and tests): the link goes to the
// log instead of an inbox. Never leave it like this in production, where links are secrets.
export class LogAccountMailer implements IAccountMailer {
  constructor(private readonly appUrl: string) {}

  async sendEmailVerification({ to, token }: IParamsAccountEmail): Promise<void> {
    this.log('verify-email', to, accountLink(this.appUrl, 'verify-email', token));
  }

  async sendPasswordReset({ to, token }: IParamsAccountEmail): Promise<void> {
    this.log('reset-password', to, accountLink(this.appUrl, 'reset-password', token));
  }

  private log(kind: string, to: string, link: string): void {
    Logger.warn('E-mail not sent: RESEND_API_KEY is not set', {
      eventName: 'email.logged_instead_of_sent',
      kind,
      to,
      link,
    });
  }
}
