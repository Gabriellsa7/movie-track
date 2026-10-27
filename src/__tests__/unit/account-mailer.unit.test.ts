import { Logger } from 'traceability';
import { ServiceUnavailableError } from '../../domain/errors/service-unavailable.error';
import {
  accountLink,
  emailVerificationEmail,
  passwordResetEmail,
} from '../../infrastructure/providers/account-mailer/account-emails';
import { LogAccountMailer } from '../../infrastructure/providers/account-mailer/log.account-mailer';
import { ResendAccountMailer } from '../../infrastructure/providers/account-mailer/resend.account-mailer';
import { CryptoSecureTokenProvider } from '../../infrastructure/providers/secure-token/crypto.secure-token-provider';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  warnSpy = jest.spyOn(Logger, 'warn').mockImplementation(() => Logger);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('When we generate one-time tokens', () => {
  const provider = new CryptoSecureTokenProvider();

  it('should return a random URL-safe token and its SHA-256 hash', () => {
    const first = provider.generate();
    const second = provider.generate();

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.token).not.toBe(second.token);
    expect(provider.hash(first.token)).toBe(first.hash);
  });
});

describe('When we build account e-mail links and contents', () => {
  it('should join the app URL and the page, with or without a trailing slash', () => {
    expect(accountLink('http://localhost:5173', 'verify-email', 'a b')).toBe(
      'http://localhost:5173/verify-email?token=a+b',
    );
    expect(accountLink('https://app.example.com/', 'reset-password', 'x')).toBe(
      'https://app.example.com/reset-password?token=x',
    );
  });

  it('should escape the name in the HTML and keep the link in both versions', () => {
    const email = emailVerificationEmail(
      '<script>alert(1)</script>',
      'https://app.example.com/verify-email?token=x&y=1',
    );

    expect(email.subject).toBe('Confirme seu e-mail no Movie Track');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain(
      'href="https://app.example.com/verify-email?token=x&amp;y=1"',
    );
    expect(email.text).toContain(
      'https://app.example.com/verify-email?token=x&y=1',
    );
  });

  it('should explain the reset link expires in 1 hour', () => {
    const email = passwordResetEmail('Whitebeard', 'https://app/reset');

    expect(email.subject).toBe('Redefina sua senha no Movie Track');
    expect(email.text).toContain('1 hora');
  });
});

describe('When we send account e-mails through Resend', () => {
  const fetchMock = jest.fn();
  const mailer = new ResendAccountMailer({
    apiKey: 're_test',
    from: 'Movie Track <onboarding@resend.dev>',
    appUrl: 'https://app.example.com',
    fetch: fetchMock,
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ id: 'email-1' }));
  });

  it('should post the verification e-mail with the link to the front-end', async () => {
    await mailer.sendEmailVerification({
      to: 'whitebeard@email.com',
      name: 'Whitebeard',
      token: 'plain-token',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: 'Movie Track <onboarding@resend.dev>',
      to: ['whitebeard@email.com'],
      subject: 'Confirme seu e-mail no Movie Track',
    });
    expect(body.text).toContain(
      'https://app.example.com/verify-email?token=plain-token',
    );
  });

  it('should link the reset e-mail to the reset page', async () => {
    await mailer.sendPasswordReset({
      to: 'whitebeard@email.com',
      name: 'Whitebeard',
      token: 'plain-token',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain(
      'https://app.example.com/reset-password?token=plain-token',
    );
  });

  it('should throw 503 EMAIL_UNAVAILABLE and log the reason when Resend refuses', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'You can only send testing emails to your own email address' }, 403),
    );

    await expect(
      mailer.sendEmailVerification({ to: 'a@b.com', name: 'A', token: 't' }),
    ).rejects.toMatchObject({ status: 503, code: 'EMAIL_UNAVAILABLE' });
    expect(warnSpy).toHaveBeenCalledWith('Resend request failed', {
      eventName: 'resend.request_failed',
      upstreamStatus: 403,
      upstreamMessage:
        'You can only send testing emails to your own email address',
    });
  });

  it('should throw 503 when Resend cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));

    await expect(
      mailer.sendPasswordReset({ to: 'a@b.com', name: 'A', token: 't' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(warnSpy).toHaveBeenCalledWith('Resend request failed', {
      eventName: 'resend.request_failed',
      error: 'The operation was aborted',
    });
  });

  it('should still throw 503 when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    await expect(
      mailer.sendPasswordReset({ to: 'a@b.com', name: 'A', token: 't' }),
    ).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
  });
});

describe('When we send account e-mails without Resend configured', () => {
  it('should log the link instead of sending it', async () => {
    const mailer = new LogAccountMailer('http://localhost:5173');

    await mailer.sendEmailVerification({
      to: 'whitebeard@email.com',
      name: 'Whitebeard',
      token: 'plain-token',
    });
    await mailer.sendPasswordReset({
      to: 'whitebeard@email.com',
      name: 'Whitebeard',
      token: 'reset-token',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'E-mail not sent: RESEND_API_KEY is not set',
      {
        eventName: 'email.logged_instead_of_sent',
        kind: 'verify-email',
        to: 'whitebeard@email.com',
        link: 'http://localhost:5173/verify-email?token=plain-token',
      },
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'E-mail not sent: RESEND_API_KEY is not set',
      expect.objectContaining({
        kind: 'reset-password',
        link: 'http://localhost:5173/reset-password?token=reset-token',
      }),
    );
  });
});
