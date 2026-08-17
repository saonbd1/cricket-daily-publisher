import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export function buildLoginUrl({ portalUrl, appId, origin, nonce }: { portalUrl: string; appId: string; origin: string; nonce: string }) {
  const redirectUri = `${origin}/api/oauth/callback`;
  const state = encodeOAuthState({ redirectUri, nonce });
  const url = new URL(`${portalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  return url.toString();
}

export function launchLogin({
  portalUrl,
  appId,
  origin,
  nonce,
  setCookie,
  navigate,
}: {
  portalUrl: string;
  appId: string;
  origin: string;
  nonce: string;
  setCookie: (value: string) => void;
  navigate: (url: string) => void;
}) {
  setCookie(`${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`);
  navigate(buildLoginUrl({ portalUrl, appId, origin, nonce }));
}

export const startLogin = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  if (!oauthPortalUrl || !appId) {
    throw new Error("OAuth configuration is missing. Check VITE_OAUTH_PORTAL_URL and VITE_APP_ID.");
  }

  launchLogin({
    portalUrl: oauthPortalUrl,
    appId,
    origin: window.location.origin,
    nonce: crypto.randomUUID(),
    setCookie: value => {
      document.cookie = value;
    },
    navigate: url => {
      window.location.href = url;
    },
  });
};
