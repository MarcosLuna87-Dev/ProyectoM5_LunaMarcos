import { describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { listIssuesHandler } from "../../src/tools/list-issues.tool.js";
import { withRetry } from "../../src/utils/retry.js";

function createMockGithub(mockFn = vi.fn()) {
    return {
        rest: {
            issues: {
                listForRepo: (params: any) => withRetry(() => mockFn(params)),
            },
        },
    } as unknown as Octokit;
}

const rateLimitError = Object.assign(
    new Error("Too Many Requests"),
    { status: 429 },
);

describe("listIssuesHandler", () => {
    it("retorna los issues abiertos correctamente mapeados (sin PRs)", async () => {
        const listForRepo = vi.fn().mockResolvedValue({
            data: [
                {
                    number: 1,
                    title: "Bug en producción",
                    html_url: "https://github.com/user/repo/issues/1",
                    state: "open",
                    // pull_request ausente → es issue real
                },
                {
                    number: 2,
                    title: "PR que no debe aparecer",
                    html_url: "https://github.com/user/repo/pull/2",
                    state: "open",
                    pull_request: { url: "https://api.github.com/..." },
                },
            ],
        });

        const github = createMockGithub(listForRepo);

        const result = await listIssuesHandler(
            { owner: "user", repo: "my-repo" },
            github,
        );

        expect("isError" in result).toBe(false);

        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.ok).toBe(true);
        expect(parsed.data).toHaveLength(1);
        expect(parsed.data[0]).toEqual({
            number: 1,
            title: "Bug en producción",
            url: "https://github.com/user/repo/issues/1",
            state: "open",
        });

        expect(listForRepo).toHaveBeenCalledTimes(1);
        expect(listForRepo).toHaveBeenCalledWith({
            owner: "user",
            repo: "my-repo",
            state: "open",
            per_page: 30,
        });
    });

    it("traduce un error 404 en un mensaje accionable sin reintentar", async () => {
        const notFoundError = Object.assign(
            new Error("Not Found"),
            { status: 404 },
        );

        const listForRepo = vi.fn().mockRejectedValue(notFoundError);
        const github = createMockGithub(listForRepo);

        const result = await listIssuesHandler(
            { owner: "user", repo: "repo-inexistente" },
            github,
        );

        const parsed = JSON.parse(result.content[0].text);

        expect("isError" in result).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error.code).toBe("GITHUB_ERROR");
        expect(parsed.error.message).toBe(
            "No se encontró el recurso (404). Revisá owner, repo, username o issue_number.",
        );

        // 404 no es retryable → el mock debe haberse llamado exactamente una vez
        expect(listForRepo).toHaveBeenCalledTimes(1);
    });

    it("reintenta en error 429 y tiene éxito al segundo intento", async () => {
        const listForRepo = vi.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce({
                data: [
                    {
                        number: 3,
                        title: "Issue tras retry",
                        html_url: "https://github.com/user/repo/issues/3",
                        state: "open",
                    },
                ],
            });

        const github = createMockGithub(listForRepo);

        vi.useFakeTimers();
        try {
            const promise = listIssuesHandler(
                { owner: "user", repo: "my-repo" },
                github,
            );
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(listForRepo).toHaveBeenCalledTimes(2);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.ok).toBe(true);
            expect(parsed.data[0].number).toBe(3);
        } finally {
            vi.useRealTimers();
        }
    });
});
