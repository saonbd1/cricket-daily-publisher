import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseRest } from "./supabase-rest";

describe("Supabase REST client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends service-role authorization and encoded query parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: 1 }]), { status: 200 }),
    );

    const rows = await supabaseRest<Array<{ id: number }>>("users", {
      query: { select: "id", openId: "eq.google%3A123", limit: 1 },
    });

    expect(rows).toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toContain("/rest/v1/users");
    expect(String(requestUrl)).toContain("select=id");
    expect(requestInit?.headers).toMatchObject({
      apikey: expect.any(String),
      Authorization: expect.stringContaining("Bearer "),
    });
  });

  it("converts non-success responses into bounded errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("sensitive server details that should be bounded", { status: 500 }),
    );

    await expect(supabaseRest("users")).rejects.toThrow("Supabase REST 500");
  });
});
