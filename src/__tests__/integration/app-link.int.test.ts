import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';

describe('When we open a link from an account e-mail', () => {
  it('should answer a page that sends the token to the app', async () => {
    const { statusCode, headers, text } = await supertest(app.app)
      .get('/links/reset-password')
      .query({ token: 'abc-DEF_123' });

    expect(statusCode).toBe(200);
    expect(headers['content-type']).toContain('text/html');
    expect(text).toContain('href="movietrack://reset-password?token=abc-DEF_123"');
    expect(text).toContain('window.location.replace');
  });

  it('should only accept the known actions', async () => {
    const { statusCode, body } = await supertest(app.app)
      .get('/links/delete-account')
      .query({ token: 'abc' });

    expect(statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject a token with characters a real token never has', async () => {
    const { statusCode } = await supertest(app.app)
      .get('/links/verify-email')
      .query({ token: '"><script>alert(1)</script>' });

    expect(statusCode).toBe(400);
  });
});
