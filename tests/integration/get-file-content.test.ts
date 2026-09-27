import { describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { getFileContentHandler } from "../../src/tools/get-file-content.tool.js";
import { withRetry } from "../../src/utils/retry.js";

function createMockGithub(mockFn = vi.fn()) {
    return {
        rest: {
            repos: {
                getContent: (params: any) => withRetry(() => mockFn(params)),
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
    path: "README.md",
};

// Contenido en base64 de "Hola mundo"
const base64Content = Buffer.from("Hola mundo").toString("base64");

describe("getFileContentHandler", () => {
    it("retorna el contenido del archivo decodificado desde base64", async () => {
        const getContent = vi.fn().mockResolvedValue({
            data: {
                type: "file",
                path: "README.md",
                content: base64Content,
                sha: "abc123def456",
            },
        });

        const github = createMockGithub(getContent);

        const result = await getFileContentHandler(validInput, github);

        expect("isError" in result).toBe(false);

        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.ok).toBe(true);
        expect(parsed.data).toEqual({
            path: "README.md",
            content: "Hola mundo",
            sha: "abc123def456",
        });

        expect(getContent).toHaveBeenCalledTimes(1);
        expect(getContent).toHaveBeenCalledWith({
            owner: "user",
            repo: "my-repo",
            path: "README.md",
            ref: "main",
        });
    });

    it("traduce un error 404 en un mensaje accionable sin reintentar", async () => {
        const notFoundError = Object.assign(
            new Error("Not Found"),
            { status: 404 },
        );

        const getContent = vi.fn().mockRejectedValue(notFoundError);
        const github = createMockGithub(getContent);

        const result = await getFileContentHandler(validInput, github);

        const parsed = JSON.parse(result.content[0].text);

        expect("isError" in result).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error.code).toBe("GITHUB_ERROR");
        expect(parsed.error.message).toBe(
            "No se encontró el recurso (404). Revisá owner, repo, username o issue_number.",
        );

        // 404 no es retryable → el mock debe haberse llamado exactamente una vez
        expect(getContent).toHaveBeenCalledTimes(1);
    });

    it("reintenta en error 429 y tiene éxito al segundo intento", async () => {
        const getContent = vi.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce({
                data: {
                    type: "file",
                    path: "README.md",
                    content: base64Content,
                    sha: "abc123def456",
                },
            });

        const github = createMockGithub(getContent);

        vi.useFakeTimers();
        try {
            const promise = getFileContentHandler(validInput, github);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(getContent).toHaveBeenCalledTimes(2);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.ok).toBe(true);
            expect(parsed.data.content).toBe("Hola mundo");
        } finally {
            vi.useRealTimers();
        }
    });
});
