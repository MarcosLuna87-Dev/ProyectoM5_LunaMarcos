import { describe, it, expect } from "vitest";
import { createFileInputSchema } from "../../../src/schemas/create-file.schema.js";

describe("createFileInputSchema - safeParse edge cases", () => {

    it("debería fallar cuando path comienza con '/' (ruta absoluta prohibida)", () => {
        const result = createFileInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            path: "/src/index.ts",   // edge: ruta con slash al inicio
            content: "hola",
            message: "feat: add file",
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

    it("debería fallar cuando owner excede 39 caracteres", () => {
        const longOwner = "a".repeat(40); // edge: exactamente 1 más del límite
        const result = createFileInputSchema.safeParse({
            owner: longOwner,
            repo: "mi-repo",
            path: "README.md",
            content: "",
            message: "initial commit",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const ownerIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "owner"
            );
            expect(ownerIssue?.message).toBe(
                "El nombre de usuario u organización no puede exceder los 39 caracteres"
            );
            expect(ownerIssue).toBeDefined();
        }
    });

    it("debería aceptar branch como campo opcional y parsear sin él", () => {
        const result = createFileInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            path: "src/index.ts",
            content: "console.log('hola');",
            message: "feat: add entry point",
            // branch: omitido intencionalmente
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.branch).toBeUndefined();
        }
    });
});
