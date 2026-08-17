import crypto from "node:crypto";
import { ENV } from "../_core/env";
import { getOrCreateSettings, saveBloggerCredentials } from "./db";

const BLOGGER_SCOPE = "https://www.googleapis.com/auth/blogger";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const BLOGGER_API = "https://www.googleapis.com/blogger/v3";

function requireOAuthConfig() {
  if (!ENV.googleClientId || !ENV.googleClientSecret) throw new Error("Google OAuth client settings are not configured");
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString("hex");
}

export function getBloggerAuthorizationUrl(state: string, redirectUri: string) {
  requireOAuthConfig();
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: BLOGGER_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code: string, redirectUri: string) {
  requireOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = await response.json() as { access_token?: string; refresh_token?: string; error?: string };
  if (!response.ok || !body.access_token || !body.refresh_token) throw new Error(`Google token exchange failed: ${body.error ?? response.status}`);
  return body;
}

async function getAccessToken(refreshToken: string) {
  requireOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const body = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !body.access_token) throw new Error(`Google refresh failed: ${body.error ?? response.status}`);
  return body.access_token;
}

async function bloggerRequest<T>(path: string, init: RequestInit, refreshToken: string) {
  const accessToken = await getAccessToken(refreshToken);
  const response = await fetch(`${BLOGGER_API}${path}`, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  });
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`Blogger request failed (${response.status}): ${body.error?.message ?? "unknown error"}`);
  return { body, statusCode: response.status };
}

export async function completeBloggerAuthorization(code: string, redirectUri: string) {
  const token = await exchangeCode(code, redirectUri);
  const refreshToken = token.refresh_token;
  if (!refreshToken) throw new Error("Google authorization did not return a refresh token");
  const blog = await bloggerRequest<{ id?: string; url?: string }>(`/blogs/byurl?url=${encodeURIComponent("https://watchnowcricket.blogspot.com")}&fetchUserInfo=false`, { method: "GET" }, refreshToken);
  if (!blog.body.id) throw new Error("Google authorization succeeded, but the Watch Now Cricket blog could not be found");
  await saveBloggerCredentials(refreshToken, blog.body.id);
  return { blogId: blog.body.id, blogUrl: blog.body.url ?? "https://watchnowcricket.blogspot.com" };
}

export async function getStoredBloggerSettings() {
  const settings = await getOrCreateSettings();
  if (settings.blogId === "pending" || !settings.googleRefreshToken) throw new Error("Blogger authorization is not complete");
  return settings;
}

export type BloggerPost = { id: string; url?: string; title?: string; content?: string };

export async function findBloggerPostByMarker(marker: string, refreshToken: string) {
  const settings = await getStoredBloggerSettings();
  const response = await bloggerRequest<{ items?: BloggerPost[] }>(`/blogs/${encodeURIComponent(settings.blogId)}/posts/search?q=${encodeURIComponent(marker)}&fetchBodies=true`, { method: "GET" }, refreshToken);
  const post = response.body.items?.find(item => item.content?.includes(marker));
  return post ?? null;
}

export async function createBloggerPost(title: string, content: string, labels: string[], refreshToken: string) {
  const settings = await getStoredBloggerSettings();
  const response = await bloggerRequest<BloggerPost>(`/blogs/${encodeURIComponent(settings.blogId)}/posts/`, { method: "POST", body: JSON.stringify({ title, content, labels }) }, refreshToken);
  return { post: response.body, statusCode: response.statusCode };
}

export async function updateBloggerPost(postId: string, title: string, content: string, labels: string[], refreshToken: string) {
  const settings = await getStoredBloggerSettings();
  const response = await bloggerRequest<BloggerPost>(`/blogs/${encodeURIComponent(settings.blogId)}/posts/${encodeURIComponent(postId)}`, { method: "PUT", body: JSON.stringify({ id: postId, title, content, labels }) }, refreshToken);
  return { post: response.body, statusCode: response.statusCode };
}
