import "server-only";
import { sql } from "@/lib/db";
import { getOAuthConfig } from "./config";

const ANAF_AUTH_BASE = "https://logincert.anaf.ro/anaf-oauth2/v1";

export function getAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    token_content_type: "jwt",
  });
  return `${ANAF_AUTH_BASE}/authorize?${params.toString()}`;
}

type TokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

async function readToken(): Promise<TokenRow | null> {
  const rows = (await sql`SELECT access_token, refresh_token, expires_at FROM efactura_oauth_token WHERE id = true`) as any[];
  return rows[0] || null;
}

async function saveToken(accessToken: string, refreshToken: string, expiresInSeconds: number) {
  const expiresAt = new Date(Date.now() + Math.max(expiresInSeconds - 60, 30) * 1000).toISOString();
  await sql`
    INSERT INTO efactura_oauth_token (id, access_token, refresh_token, expires_at, updated_at)
    VALUES (true, ${accessToken}, ${refreshToken}, ${expiresAt}::timestamptz, now())
    ON CONFLICT (id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = now()
  `;
}

/** Exchange the one-time authorization code (from the ANAF login redirect) for tokens. Run once, manually, to connect the app. */
export async function exchangeCodeForToken(code: string) {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  const res = await fetch(`${ANAF_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(`ANAF token exchange failed: ${res.status} ${JSON.stringify(data)}`);
  }
  await saveToken(data.access_token, data.refresh_token, Number(data.expires_in) || 3600);
  return data;
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getOAuthConfig();
  const res = await fetch(`${ANAF_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(`ANAF token refresh failed: ${res.status} ${JSON.stringify(data)}`);
  }
  await saveToken(data.access_token, data.refresh_token || refreshToken, Number(data.expires_in) || 3600);
  return data.access_token as string;
}

/** Returns a valid access token, refreshing it first if it's expired or close to expiring. */
export async function getAccessToken(): Promise<string> {
  const token = await readToken();
  if (!token?.refresh_token) {
    throw new Error("ANAF e-Factura nu este conectat. Autorizeaza aplicatia din Setari.");
  }
  const stillValid = token.access_token && token.expires_at && new Date(token.expires_at).getTime() > Date.now();
  if (stillValid) return token.access_token!;
  return refreshAccessToken(token.refresh_token);
}

export async function isConnected(): Promise<boolean> {
  const token = await readToken();
  return Boolean(token?.refresh_token);
}
