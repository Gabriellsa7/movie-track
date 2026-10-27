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

function buildEmail(
  name: string,
  intro: string,
  action: string,
  link: string,
  footer: string,
): IAccountEmail {
  const safeName = escapeHtml(name);
  return {
    subject: '',
    text: `Olá, ${name}!\n\n${intro}\n\n${link}\n\n${footer}`,
    html: `<p>Olá, ${safeName}!</p><p>${intro}</p><p><a href="${escapeHtml(link)}">${action}</a></p><p>${footer}</p>`,
  };
}

export function emailVerificationEmail(name: string, link: string): IAccountEmail {
  return {
    ...buildEmail(
      name,
      'Confirme seu e-mail para concluir o cadastro no Movie Track.',
      'Confirmar e-mail',
      link,
      'O link vale por 24 horas. Se você não criou esta conta, ignore este e-mail.',
    ),
    subject: 'Confirme seu e-mail no Movie Track',
  };
}

export function passwordResetEmail(name: string, link: string): IAccountEmail {
  return {
    ...buildEmail(
      name,
      'Recebemos um pedido para redefinir a senha da sua conta no Movie Track.',
      'Redefinir senha',
      link,
      'O link vale por 1 hora. Se você não pediu, ignore este e-mail: sua senha continua a mesma.',
    ),
    subject: 'Redefina sua senha no Movie Track',
  };
}

export function accountLink(appUrl: string, path: string, token: string): string {
  const url = new URL(path, appUrl.endsWith('/') ? appUrl : `${appUrl}/`);
  url.searchParams.set('token', token);
  return url.toString();
}
