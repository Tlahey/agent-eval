import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchRuns, fetchRun, fetchTestIds, fetchTestTree, fetchStats } from "./api";

describe("API client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
        statusText: "OK",
      }),
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("fetchRuns", () => {
    it("fetches all runs from /api/runs", async () => {
      await fetchRuns();
      expect(fetch).toHaveBeenCalledWith("/api/runs");
    });

    it("passes testId as query parameter", async () => {
      await fetchRuns("add close button");
      expect(fetch).toHaveBeenCalledWith("/api/runs?testId=add%20close%20button");
    });

    it("throws on non-OK response", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
        json: vi.fn(),
      } as unknown as Response);

      await expect(fetchRuns()).rejects.toThrow("Failed to fetch runs");
    });

    it("returns parsed JSON data", async () => {
      const mockData = [{ id: 1, testId: "test1" }];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
        statusText: "OK",
      } as unknown as Response);

      const result = await fetchRuns();
      expect(result).toEqual(mockData);
    });
  });

  describe("fetchRun", () => {
    it("fetches a single run by ID", async () => {
      await fetchRun(42);
      expect(fetch).toHaveBeenCalledWith("/api/runs/42");
    });

    it("throws on non-OK response", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: "Not Found",
        json: vi.fn(),
      } as unknown as Response);

      await expect(fetchRun(999)).rejects.toThrow("Failed to fetch run");
    });
  });

  describe("fetchTestIds", () => {
    it("fetches test IDs from /api/tests", async () => {
      await fetchTestIds();
      expect(fetch).toHaveBeenCalledWith("/api/tests");
    });

    it("returns an array of strings", async () => {
      const mockData = ["test-a", "test-b"];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
        statusText: "OK",
      } as unknown as Response);

      const result = await fetchTestIds();
      expect(result).toEqual(["test-a", "test-b"]);
    });

    it("throws on non-OK response", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: "Service Unavailable",
        json: vi.fn(),
      } as unknown as Response);

      await expect(fetchTestIds()).rejects.toThrow("Failed to fetch tests");
    });
  });

  describe("fetchStats", () => {
    it("fetches stats from /api/stats", async () => {
      await fetchStats();
      expect(fetch).toHaveBeenCalledWith("/api/stats");
    });

    it("throws on non-OK response", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: "Bad Gateway",
        json: vi.fn(),
      } as unknown as Response);

      await expect(fetchStats()).rejects.toThrow("Failed to fetch stats");
    });
  });

  describe("fetchTestTree", () => {
    it("fetches test tree from /api/tree", async () => {
      await fetchTestTree();
      expect(fetch).toHaveBeenCalledWith("/api/tree");
    });

    it("returns the parsed tree structure", async () => {
      const mockTree = [
        {
          name: "Suite",
          type: "suite",
          children: [{ name: "test1", type: "test", testId: "test1" }],
        },
      ];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTree),
        statusText: "OK",
      } as unknown as Response);

      const result = await fetchTestTree();
      expect(result).toEqual(mockTree);
    });

    it("throws on non-OK response", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: "Service Unavailable",
        json: vi.fn(),
      } as unknown as Response);

      await expect(fetchTestTree()).rejects.toThrow("Failed to fetch test tree");
    });
  });
});
