import { describe, it, expect } from "vitest";
import { getFileContentInputSchema } from "../../../src/schemas/get-file-content.schema.js";

describe("getFileContentInputSchema - safeParse edge cases", () => {

    it("debería fallar cuando path comienza con '/' (ruta absoluta prohibida)", () => {
        const result = getFileContentInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            path: "/package.json",   // edge: slash al inicio
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const pathIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "path"
            );
            expect(pathIssue?.message).toBe(
                "La ruta debe ser relativa al repositorio y no debe iniciar con '/'"
            );
            expect(pathIssue).toBeDefined();
        }
    });

    it("debería fallar cuando repo contiene caracteres inválidos (ej: @)", () => {
        const result = getFileContentInputSchema.safeParse({
            owner: "usuario",
            repo: "mi@repo",    // edge: '@' no está permitido por regex
            path: "README.md",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const repoIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "repo"
            );
            expect(repoIssue?.message).toBe(
                "El nombre del repositorio solo puede contener caracteres alfanuméricos, guiones, puntos o guiones bajos"
            );
            expect(repoIssue).toBeDefined();
        }
    });

    it("debería parsear correctamente con branch omitido (campo opcional) y nombre de repo -.-", () => {
        const result = getFileContentInputSchema.safeParse({
            owner: "usuario",
            repo: "-.-",
            path: "src/index.ts",
            // branch: omitido
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.branch).toBeUndefined();
        }
    });
});
