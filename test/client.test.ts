import { describe, it, expect } from "vitest";
import { ApiClient, AuthError, NotFoundError } from "../src/api/client.ts";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const creds = { url: "https://c.com", token: "t" };

describe("ApiClient", () => {
  it("returns parsed JSON on 200", async () => {
    const client = new ApiClient(creds, fakeFetch(200, { ok: true }));
    expect(await client.request("GET", "/applications")).toEqual({ ok: true });
  });

  it("builds the correct URL and auth header", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const spy = (async (url: string, init: RequestInit) => {
      seenUrl = url;
      seenAuth = (init.headers as Record<string, string>)["Authorization"];
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    await new ApiClient(creds, spy).request("GET", "/applications");
    expect(seenUrl).toBe("https://c.com/api/v1/applications");
    expect(seenAuth).toBe("Bearer t");
  });

  it("maps 401 to AuthError", async () => {
    const client = new ApiClient(creds, fakeFetch(401, { message: "bad token" }));
    await expect(client.request("GET", "/x")).rejects.toBeInstanceOf(AuthError);
  });

  it("maps 404 to NotFoundError with message", async () => {
    const client = new ApiClient(creds, fakeFetch(404, { message: "gone" }));
    await expect(client.request("GET", "/x")).rejects.toThrow("gone");
    await expect(client.request("GET", "/x")).rejects.toBeInstanceOf(NotFoundError);
  });
});
