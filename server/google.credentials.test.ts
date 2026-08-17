import { describe, expect, it } from "vitest";

describe("Google OAuth credentials", () => {
  it("are accepted by Google’s token endpoint", async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    expect(clientId, "GOOGLE_CLIENT_ID must be configured").toBeTruthy();
    expect(clientSecret, "GOOGLE_CLIENT_SECRET must be configured").toBeTruthy();

    const body = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code: "invalid-test-code",
      grant_type: "authorization_code",
      redirect_uri: "https://cricket-daily-publisher.vercel.app/api/google/callback",
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response.json()) as { error?: string };

    // Google must reject the deliberately invalid code, not the client itself.
    expect(response.status).toBe(400);
    expect(payload.error).not.toBe("invalid_client");
  }, 15_000);
});
