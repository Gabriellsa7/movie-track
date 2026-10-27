import { Logger } from 'traceability';
import {
  IAccountMailer,
  IParamsAccountEmail,
} from '../../../domain/common/providers/account-mailer.provider';
import { ServiceUnavailableError } from '../../../domain/errors/service-unavailable.error';
import {
  accountLink,
  emailVerificationEmail,
  IAccountEmail,
  passwordResetEmail,
} from './account-emails';

const RESEND_API_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MILLISECONDS = 5000;

export interface IParamsResendAccountMailer {
  apiKey: string;
  from: string;
  appUrl: string;
  fetch?: typeof fetch;
}

export class ResendAccountMailer implements IAccountMailer {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly appUrl: string;
  private readonly fetch: typeof fetch;

  constructor({ apiKey, from, appUrl, fetch: fetchFn }: IParamsResendAccountMailer) {
    this.apiKey = apiKey;
    this.from = from;
    this.appUrl = appUrl;
    this.fetch = fetchFn ?? fetch;
  }

  sendEmailVerification({ to, name, token }: IParamsAccountEmail): Promise<void> {
    const link = accountLink(this.appUrl, 'verify-email', token);
    return this.send(to, emailVerificationEmail(name, link));
  }

  sendPasswordReset({ to, name, token }: IParamsAccountEmail): Promise<void> {
    const link = accountLink(this.appUrl, 'reset-password', token);
    return this.send(to, passwordResetEmail(name, link));
  }

  private async send(to: string, email: IAccountEmail): Promise<void> {
    let response: Response;
    try {
      response = await this.fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to: [to], ...email }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw this.unavailableError({
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (!response.ok) {
      throw this.unavailableError({
        upstreamStatus: response.status,
        upstreamMessage: await this.readErrorMessage(response),
      });
    }
  }

  private async readErrorMessage(response: Response): Promise<string | undefined> {
    try {
      const body = (await response.json()) as { message?: unknown };
      return typeof body.message === 'string' ? body.message : undefined;
    } catch {
      return undefined;
    }
  }

  // The client only learns that e-mail is down; the reason goes to the log.
  private unavailableError(details: Record<string, unknown>): ServiceUnavailableError {
    Logger.warn('Resend request failed', {
      eventName: 'resend.request_failed',
      ...details,
    });
    return new ServiceUnavailableError(
      'E-mail service unavailable',
      'EMAIL_UNAVAILABLE',
    );
  }
}
