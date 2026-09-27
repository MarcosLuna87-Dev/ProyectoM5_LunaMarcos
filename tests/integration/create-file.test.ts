import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Octokit } from "@octokit/rest";

// vi.mock es hoisted automáticamente por Vitest antes de los imports
vi.mock("../../src/github/commit-files.js");

import { commiFiles } from "../../src/github/commit-files.js";
import { createFileHandler } from "../../src/tools/create-file.tool";

const mockCommiFiles = vi.mocked(commiFiles);

const rateLimitError = Object.assign(
    new Error("Too Many Requests"),
    { status: 429 },
);

const validInput = {
    owner: "user",
    repo: "my-repo",
    path: "README.md",
    content: "# Hello World",
    message: "Add README",
};

const commitResult = {
    commit: "sha789abc",
    url: "https://github.com/user/my-repo/commit/sha789abc",
    branch: "main",
    paths: ["README.md"],
};

describe("createFileHandler", () => {
    beforeEach(() => {
        mockCommiFiles.mockReset();
    });

    it("crea un archivo y retorna el resultado del commit correctamente", async () => {
        mockCommiFiles.mockResolvedValue(commitResult);

        const result = await createFileHandler(
            validInput,
            {} as unknown as Octokit,
        );

        expect("isError" in result).toBe(false);

        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.ok).toBe(true);
        expect(parsed.data).toEqual(commitResult);

        expect(mockCommiFiles).toHaveBeenCalledTimes(1);
        expect(mockCommiFiles).toHaveBeenCalledWith(
            expect.anything(), // octokit
            {
                owner: "user",
                repo: "my-repo",
                files: [{ path: "README.md", content: "# Hello World" }],
                message: "Add README",
                branch: "main",
            },
        );
    });

    it("traduce un error 422 en un mensaje accionable sin reintentar", async () => {
        const unprocessableError = Object.assign(
            new Error("Unprocessable Entity"),
            { status: 422 },
        );

        mockCommiFiles.mockRejectedValue(unprocessableError);

        const result = await createFileHandler(
            validInput,
            {} as unknown as Octokit,
        );

        const parsed = JSON.parse(result.content[0].text);

        expect("isError" in result).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error.code).toBe("GITHUB_ERROR");
        expect(parsed.error.message).toBe(
            "GitHub rechazó los datos (422). Revisá título/estado o si el repo tiene issues habilitados.",
        );

        // 422 no es retryable → el mock debe haberse llamado exactamente una vez
        expect(mockCommiFiles).toHaveBeenCalledTimes(1);
    });

    it("traduce un error 429 en un mensaje accionable de ratelimit", async () => {
        mockCommiFiles.mockRejectedValue(rateLimitError);

        const result = await createFileHandler(
            validInput,
            {} as unknown as Octokit,
        );

        const parsed = JSON.parse(result.content[0].text);

        expect("isError" in result).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error.code).toBe("GITHUB_ERROR");
        expect(parsed.error.message).toBe(
            "Ratelimit de GitHub (403/429). Espere el reset de la API",
        );

        expect(mockCommiFiles).toHaveBeenCalledTimes(1);
    });
});
