const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

export function appDeepLink(
  appDeepLinkUrl: string,
  action: string,
  token: string,
): string {
  const base = appDeepLinkUrl.endsWith('/')
    ? appDeepLinkUrl.slice(0, -1)
    : appDeepLinkUrl;
  return `${base}/${action}?token=${encodeURIComponent(token)}`;
}

// E-mail clients rarely make custom-scheme links clickable, so the e-mail points here (https)
// and this page hands the link over to the app.
export function appLinkPage(deepLink: string): string {
  const link = escapeHtml(deepLink);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open Movie Track</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0F1115;color:#E8E6E3;font-family:Inter,system-ui,sans-serif;text-align:center}
main{max-width:340px;padding:24px}
h1{margin:0 0 8px;font-size:22px}
p{margin:0 0 24px;color:#8A8F98;line-height:1.5}
a{display:block;padding:16px;border-radius:12px;background:#F5B83D;color:#0F1115;font-weight:600;text-decoration:none}
</style>
</head>
<body>
<main>
<h1>Opening Movie Track…</h1>
<p>If the app does not open, tap the button on the phone where it is installed.</p>
<a href="${link}">Open Movie Track</a>
</main>
<script>window.location.replace(${JSON.stringify(deepLink).replace(/</g, '\\u003c')});</script>
</body>
</html>`;
}
