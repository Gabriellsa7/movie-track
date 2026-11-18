import { ELanguage } from '../../../domain/common/language';

export interface IAccountEmail {
  subject: string;
  html: string;
  text: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// The name is typed by the user, so it must not inject markup into the e-mail.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

interface IEmailCopy {
  greeting: string;
  intro: string;
  action: string;
  footer: string;
  subject: string;
}

const VERIFICATION_COPY: Record<ELanguage, IEmailCopy> = {
  [ELanguage.EN]: {
    greeting: 'Hi',
    intro: 'Confirm your e-mail to finish signing up for Movie Track.',
    action: 'Confirm e-mail',
    footer:
      'The link is valid for 24 hours. If you did not create this account, ignore this e-mail.',
    subject: 'Confirm your e-mail on Movie Track',
  },
  [ELanguage.PT_BR]: {
    greeting: 'Olá',
    intro: 'Confirme seu e-mail para concluir o cadastro no Movie Track.',
    action: 'Confirmar e-mail',
    footer:
      'O link vale por 24 horas. Se você não criou esta conta, ignore este e-mail.',
    subject: 'Confirme seu e-mail no Movie Track',
  },
};

const PASSWORD_RESET_COPY: Record<ELanguage, IEmailCopy> = {
  [ELanguage.EN]: {
    greeting: 'Hi',
    intro:
      'We received a request to reset the password of your Movie Track account.',
    action: 'Reset password',
    footer:
      'The link is valid for 1 hour. If you did not ask for it, ignore this e-mail: your password stays the same.',
    subject: 'Reset your password on Movie Track',
  },
  [ELanguage.PT_BR]: {
    greeting: 'Olá',
    intro:
      'Recebemos um pedido para redefinir a senha da sua conta no Movie Track.',
    action: 'Redefinir senha',
    footer:
      'O link vale por 1 hora. Se você não pediu, ignore este e-mail: sua senha continua a mesma.',
    subject: 'Redefina sua senha no Movie Track',
  },
};

function buildEmail(
  name: string,
  link: string,
  copy: IEmailCopy,
): IAccountEmail {
  const safeName = escapeHtml(name);
  return {
    subject: copy.subject,
    text: `${copy.greeting}, ${name}!\n\n${copy.intro}\n\n${link}\n\n${copy.footer}`,
    html: `<p>${copy.greeting}, ${safeName}!</p><p>${copy.intro}</p><p><a href="${escapeHtml(link)}">${copy.action}</a></p><p>${copy.footer}</p>`,
  };
}

export function emailVerificationEmail(
  name: string,
  link: string,
  language: ELanguage,
): IAccountEmail {
  return buildEmail(name, link, VERIFICATION_COPY[language]);
}

export function passwordResetEmail(
  name: string,
  link: string,
  language: ELanguage,
): IAccountEmail {
  return buildEmail(name, link, PASSWORD_RESET_COPY[language]);
}
export function accountLink(appUrl: string, path: string, token: string): string {
  const url = new URL(path, appUrl.endsWith('/') ? appUrl : `${appUrl}/`);
  url.searchParams.set('token', token);
  return url.toString();
}
