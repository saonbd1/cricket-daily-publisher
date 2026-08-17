import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUserUpsertValues, getUserByOpenId, upsertUser } from "./db.js";
import {
  consumeOAuthState,
  createRun,
  finishRun,
  getOrCreateSettings,
  listRecentFixtures,
  listRuns,
  saveOAuthState,
  upsertNormalizedFixture,
} from "./publisher/db.js";

describe("Supabase REST persistence contracts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves owner admin role and user read/upsert requests", async () => {
    const ownerPayload = buildUserUpsertValues({ openId: "owner", name: "Owner" }, "owner");
    expect(ownerPayload.role).toBe("admin");

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("[]", { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, openId: "owner", role: "admin" }]), { status: 200 }));

    await upsertUser({ openId: "owner", name: "Owner" });
    const user = await getUserByOpenId("owner");
    expect(user?.role).toBe("admin");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("users?on_conflict=openId");
  });

  it("preserves settings, fixture/tournament, and run-history request contracts", async () => {
    const fixture = {
      externalId: "fixture-1",
      tournamentName: "Test Cup",
      teamOne: "A",
      teamTwo: "B",
      venue: "Dhaka",
      startTimeUtc: new Date("2026-08-18T12:00:00.000Z"),
      localDateGmt6: "2026-08-18",
      localTimeGmt6: "18:00",
      status: "scheduled" as const,
      scoreSummary: null,
      matchUrl: null,
    };
    const run = { id: 9, trigger: "manual", status: "running" };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, blogId: "pending", blogUrl: "https://watchnowcricket.blogspot.com" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, blogId: "pending", blogUrl: "https://watchnowcricket.blogspot.com" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, blogId: "pending", blogUrl: "https://watchnowcricket.blogspot.com", oauthState: "state-1" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 7, name: "Test Cup", normalizedName: "test cup" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 8, ...fixture, tournamentId: 7 }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 8, ...fixture, tournament: { id: 7, name: "Test Cup" } }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([run]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...run, status: "success" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...run, status: "success" }]), { status: 200 }));

    const settings = await getOrCreateSettings();
    expect(settings.blogUrl).toContain("watchnowcricket");
    await saveOAuthState("state-1");
    expect(await consumeOAuthState("state-1")).toBe(true);
    const savedFixture = await upsertNormalizedFixture(fixture);
    expect(savedFixture.tournamentId).toBe(7);
    expect((await listRecentFixtures())[0]?.tournament.name).toBe("Test Cup");
    expect(await createRun("manual")).toBe(9);
    await finishRun(9, { status: "success" });
    expect((await listRuns())[0]?.status).toBe("success");
  });
});
