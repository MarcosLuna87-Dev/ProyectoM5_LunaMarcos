import { describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { createIssueHandler } from "../../src/tools/create-issue.tool.js";
import { withRetry } from "../../src/utils/retry.js";

function createMockGithub(mockFn = vi.fn()) {
    return {
        rest: {
            issues: {
                create: (params: any) => withRetry(() => mockFn(params)),
            },
        },
    } as unknown as Octokit;
}

const rateLimitError = Object.assign(
    new Error("Too Many Requests"),
    { status: 429 },
);

const validInput = {
    owner: "user",
    repo: "my-repo",
    title: "Bug: algo está roto",
    body: "Descripción del bug",
};

describe("createIssueHandler", () => {
    it("crea un issue y retorna el IssueDto correctamente mapeado", async () => {
        const create = vi.fn().mockResolvedValue({
            data: {
                number: 42,
                title: "Bug: algo está roto",
                url: "https://api.github.com/repos/user/my-repo/issues/42",
                state: "open",
            },
        });

        const github = createMockGithub(create);

        const result = await createIssueHandler(validInput, github);

        expect("isError" in result).toBe(false);

        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.ok).toBe(true);
        expect(parsed.data).toEqual({
            number: 42,
            title: "Bug: algo está roto",
            url: "https://api.github.com/repos/user/my-repo/issues/42",
            state: "open",
        });

        expect(create).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledWith({
            owner: "user",
            repo: "my-repo",
            title: "Bug: algo está roto",
            body: "Descripción del bug",
        });
    });

    it("traduce un error 422 en un mensaje accionable sin reintentar", async () => {
        const unprocessableError = Object.assign(
            new Error("Unprocessable Entity"),
            { status: 422 },
        );

        const create = vi.fn().mockRejectedValue(unprocessableError);
        const github = createMockGithub(create);

        const result = await createIssueHandler(validInput, github);

        const parsed = JSON.parse(result.content[0].text);

        expect("isError" in result).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error.code).toBe("GITHUB_ERROR");
        expect(parsed.error.message).toBe(
            "GitHub rechazó los datos (422). Revisá título/estado o si el repo tiene issues habilitados.",
        );

        // 422 no es retryable → el mock debe haberse llamado exactamente una vez
        expect(create).toHaveBeenCalledTimes(1);
    });

    it("reintenta en error 429 y tiene éxito al segundo intento", async () => {
        const create = vi.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce({
                data: {
                    number: 43,
                    title: "Bug: algo está roto",
                    url: "https://api.github.com/repos/user/my-repo/issues/43",
                    state: "open",
                },
            });

        const github = createMockGithub(create);

        vi.useFakeTimers();
        try {
            const promise = createIssueHandler(validInput, github);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(create).toHaveBeenCalledTimes(2);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.ok).toBe(true);
            expect(parsed.data.number).toBe(43);
        } finally {
            vi.useRealTimers();
        }
    });
});
