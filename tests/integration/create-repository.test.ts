import { describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { createRepoHandler } from "../../src/tools/create-repository.tool.js";
import { withRetry } from "../../src/utils/retry.js";

function createMockGithub(mockFn = vi.fn()) {
    return {
        rest: {
            repos: {
                createForAuthenticatedUser: (params: any) => withRetry(() => mockFn(params)),
            },
        },
    } as unknown as Octokit;
}

const rateLimitError = Object.assign(
    new Error("Too Many Requests"),
    { status: 429 },
);

const validInput = {
    name: "nuevo-repo",
    description: "Mi nuevo repositorio",
    private: false,
    auto_init: true,
};

describe("createRepoHandler", () => {
    it("crea un repositorio y retorna el CreateRepoDto correctamente mapeado", async () => {
        const createForAuthenticatedUser = vi.fn().mockResolvedValue({
            data: {
                name: "nuevo-repo",
                full_name: "user/nuevo-repo",
                html_url: "https://github.com/user/nuevo-repo",
                description: "Mi nuevo repositorio",
                private: false,
            },
        });

        const github = createMockGithub(createForAuthenticatedUser);

        const result = await createRepoHandler(validInput, github);

        expect("isError" in result).toBe(false);

        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.ok).toBe(true);
        expect(parsed.data).toEqual({
            name: "nuevo-repo",
            fullName: "user/nuevo-repo",
            url: "https://github.com/user/nuevo-repo",
            description: "Mi nuevo repositorio",
            private: false,
        });

        expect(createForAuthenticatedUser).toHaveBeenCalledTimes(1);
        expect(createForAuthenticatedUser).toHaveBeenCalledWith({
            name: "nuevo-repo",
            description: "Mi nuevo repositorio",
            private: false,
            auto_init: true,
        });
    });

    it("traduce un error 401 en un mensaje accionable sin reintentar", async () => {
        const unauthorizedError = Object.assign(
            new Error("Bad credentials"),
            { status: 401 },
        );

        const createForAuthenticatedUser = vi
            .fn()
            .mockRejectedValue(unauthorizedError);

        const github = createMockGithub(createForAuthenticatedUser);

        const result = await createRepoHandler(validInput, github);

        const parsed = JSON.parse(result.content[0].text);

        expect("isError" in result).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error.code).toBe("AUTHENTICATION_ERROR");
        expect(parsed.error.message).toBe(
            "Token invalido (401). Revisá GITHUB_TOKEN en el .env",
        );

        // 401 no es retryable → el mock debe haberse llamado exactamente una vez
        expect(createForAuthenticatedUser).toHaveBeenCalledTimes(1);
    });

    it("reintenta en error 429 y tiene éxito al segundo intento", async () => {
        const createForAuthenticatedUser = vi.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce({
                data: {
                    name: "nuevo-repo",
                    full_name: "user/nuevo-repo",
                    html_url: "https://github.com/user/nuevo-repo",
                    description: "Mi nuevo repositorio",
                    private: false,
                },
            });

        const github = createMockGithub(createForAuthenticatedUser);

        vi.useFakeTimers();
        try {
            const promise = createRepoHandler(validInput, github);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(createForAuthenticatedUser).toHaveBeenCalledTimes(2);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.ok).toBe(true);
            expect(parsed.data.name).toBe("nuevo-repo");
        } finally {
            vi.useRealTimers();
        }
    });
});
