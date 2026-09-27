import { describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { listRepositoriesHandler } from "../../src/tools/list-repositories.tool.js";
import { withRetry } from "../../src/utils/retry.js";

function createMockGithub(mockFn = vi.fn()) {
    return {
        rest: {
            repos: {
                listForAuthenticatedUser: (params: any) => withRetry(() => mockFn(params)),
            },
        },
    } as unknown as Octokit;
}

describe("listRepositoriesHandler", () => {
    it("retorna los repositorios correctamente mapeados", async () => {
        const listForAuthenticatedUser = vi.fn().mockResolvedValue({
            data: [
                {
                    name: "repo-test",
                    full_name: "user/repo-test",
                    html_url: "https://github.com/user/repo-test",
                    private: false,
                    stargazers_count: 10,
                    language: "TypeScript",
                },
            ],
        });

        const github = createMockGithub(listForAuthenticatedUser);

        const result = await listRepositoriesHandler(
            { type: "all" },
            github,
        );

        expect("isError" in result).toBe(false);

        const parsed = JSON.parse(result.content[0].text);

        expect(parsed).toEqual({
            ok: true,
            data: [
                {
                    name: "repo-test",
                    fullName: "user/repo-test",
                    url: "https://github.com/user/repo-test",
                    private: false,
                    stars: 10,
                    language: "TypeScript",
                },
            ],
        });

        expect(listForAuthenticatedUser).toHaveBeenCalledTimes(1);
        expect(listForAuthenticatedUser).toHaveBeenCalledWith({
            type: "all",
            per_page: 10,
        });
    });

    it("traduce un error 401 en un mensaje accionable", async () => {
        const unauthorizedError = Object.assign(
            new Error("Bad credentials"),
            {
                status: 401,
            },
        );

        const listForAuthenticatedUser = vi
            .fn()
            .mockRejectedValue(unauthorizedError);

        const github = createMockGithub(listForAuthenticatedUser);

        const result = await listRepositoriesHandler(
            { type: "all" },
            github,
        );

        const parsed = JSON.parse(result.content[0].text);

        expect("isError" in result).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error.code).toBe("AUTHENTICATION_ERROR");
        expect(parsed.error.message).toBe(
            "Token invalido (401). Revisá GITHUB_TOKEN en el .env",
        );

        expect(result.content[0].text).toMatch(
            /token|credencial|autenticaci/i,
        );
        expect(result.content[0].text).not.toContain("stack");
    });

    it("reintenta en error 429 y tiene éxito al segundo intento", async () => {
        const rateLimitError = Object.assign(
            new Error("Too Many Requests"),
            { status: 429 },
        );

        const successData = {
            data: [
                {
                    name: "repo-test",
                    full_name: "user/repo-test",
                    html_url: "https://github.com/user/repo-test",
                    private: false,
                    stargazers_count: 5,
                    language: "TypeScript",
                },
            ],
        };

        const listForAuthenticatedUser = vi
            .fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce(successData);

        const github = createMockGithub(listForAuthenticatedUser);

        vi.useFakeTimers();
        try {
            const promise = listRepositoriesHandler({ type: "all" }, github);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(listForAuthenticatedUser).toHaveBeenCalledTimes(2);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.ok).toBe(true);
            expect(parsed.data[0].name).toBe("repo-test");
        } finally {
            vi.useRealTimers();
        }
    });
});
