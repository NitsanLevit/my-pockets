import "server-only";
import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  // web-push requires the subject to be a "mailto:" or "https:" URL —
  // NEXT_PUBLIC_APP_URL is "http://localhost:3000" in local dev, which
  // doesn't qualify, so fall back to a generic placeholder there.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const subject = appUrl?.startsWith("https:") ? appUrl : "mailto:admin@example.com";
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export { webpush };
