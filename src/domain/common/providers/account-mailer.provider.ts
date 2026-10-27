export interface IParamsAccountEmail {
  to: string;
  name: string;
  token: string;
}

export interface IAccountMailer {
  sendEmailVerification(params: IParamsAccountEmail): Promise<void>;
  sendPasswordReset(params: IParamsAccountEmail): Promise<void>;
}
