import { ELanguage } from '../language';

export interface IParamsAccountEmail {
  to: string;
  name: string;
  token: string;
  language: ELanguage;
}

export interface IAccountMailer {
  sendEmailVerification(params: IParamsAccountEmail): Promise<void>;
  sendPasswordReset(params: IParamsAccountEmail): Promise<void>;
}
