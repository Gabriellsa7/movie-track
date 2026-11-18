import {
  appDeepLink,
  appLinkPage,
} from '../../interfaces/http/controllers/app-link.page';

describe('When we build the link that opens the app', () => {
  it('should join the app address, the action and the token', () => {
    expect(appDeepLink('movietrack://', 'verify-email', 'a_b-1')).toBe(
      'movietrack://verify-email?token=a_b-1',
    );
    expect(
      appDeepLink('exp://10.0.1.56:8081/--', 'reset-password', 'tok'),
    ).toBe('exp://10.0.1.56:8081/--/reset-password?token=tok');
  });

  it('should escape the link inside the page', () => {
    const page = appLinkPage('movietrack://x?token="<b>', 'n0nce');

    expect(page).toContain('href="movietrack://x?token=&quot;&lt;b&gt;"');
    expect(page).not.toContain('"<b>"');
    expect(page).toContain('<script nonce="n0nce">');
  });
});
