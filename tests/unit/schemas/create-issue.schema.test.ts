import { describe, it, expect } from "vitest";
import { createIssueInputSchema } from "../../../src/schemas/create-issue.schema.js";

describe("createIssueInputSchema - safeParse edge cases", () => {

    it("debería fallar cuando title está vacío (solo espacios en blanco)", () => {
        const result = createIssueInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            title: "   ",   // edge: string de espacios; trim() lo convierte en ""
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const titleIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "title"
            );
            expect(titleIssue?.message).toBe("El título del issue es requerido");
            expect(titleIssue).toBeDefined();
        }
    });

    it("debería fallar cuando title supera 256 caracteres", () => {
        const result = createIssueInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            title: "x".repeat(257), // edge: exactamente 1 más del límite
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const titleIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "title"
            );
            expect(titleIssue?.message).toBe("El título no puede exceder los 256 caracteres");
            expect(titleIssue).toBeDefined();
        }
    });

    it("debería parsear correctamente cuando title tiene exactamente 256 caracteres y body omitido", () => {
        const result = createIssueInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            title: "x".repeat(256),
            // body: omitido
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.body).toBeUndefined();
        }
    });
});
