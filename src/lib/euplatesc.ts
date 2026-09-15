import { EuPlatesc } from "euplatesc";

let _client: EuPlatesc | null = null;

export function getEpClient() {
  if (!_client) {
    _client = new EuPlatesc({
      merchantId: process.env.EUPLATESC_MERCHANT_ID!,
      secretKey: process.env.EUPLATESC_SECRET_KEY!,
      testMode: process.env.EUPLATESC_TEST_MODE === "true",
    });
  }
  return _client;
}

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}
