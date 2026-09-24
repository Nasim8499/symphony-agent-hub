import { exchangeCode, googleStatus } from "@/lib/google";
import { updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function page(title: string, message: string, ok: boolean) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1.0,user-scalable=no"/>
<title>${title}</title>
<style>
  body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#fff;color:#0a0a0a;
  font-family:"Geist","Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px}
  .card{max-width:400px;text-align:center}
  .dot{width:52px;height:52px;margin:0 auto 18px;border-radius:16px;display:grid;place-items:center;
  background:${ok ? "#0a0a0a" : "#fef2f2"};color:${ok ? "#fff" : "#dc2626"};font-size:24px}
  h1{font-size:19px;margin:0 0 8px}
  p{color:#666;font-size:14px;line-height:1.6;margin:0 0 18px}
  a{display:inline-block;height:40px;line-height:40px;padding:0 18px;border-radius:10px;background:#0a0a0a;color:#fff;text-decoration:none;font-size:14px}
</style></head><body><div class="card"><div class="dot">${ok ? "✓" : "!"}</div>
<h1>${title}</h1><p>${message}</p><a href="/settings/api-keys?tab=workspace">Back to Symphony</a></div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return page("Google connection cancelled", `Google returned: ${error}`, false);
  if (!code) return page("Missing authorisation code", "Start again from Settings → Google Workspace.", false);

  try {
    const tokens = await exchangeCode(code);
    let email: string | null = null;
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { email?: string };
        email = j.email ?? null;
      }
    } catch {}
    await updateSettings({ googleRefreshToken: tokens.refresh_token ?? null, googleAccountEmail: email, googleConnectedAt: new Date() });
    const status = await googleStatus();
    return page("Google Workspace connected", `Signed in as ${email ?? status.email ?? "your Google account"}. Drive search, document export and the in-dashboard viewer are ready.`, true);
  } catch (e) {
    return page("Could not connect Google", (e as Error).message, false);
  }
}
