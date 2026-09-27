import { describe, it, expect } from "vitest";
import { createRepoInputSchema } from "../../../src/schemas/create-repository.schema.js";

describe("createRepoInputSchema - safeParse edge cases", () => {

    it("debería fallar cuando name tiene caracteres inválidos (ej: espacios)", () => {
        const result = createRepoInputSchema.safeParse({
            name: "mi repo con espacios",  // edge: el regex no acepta espacios
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const nameIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "name"
            );
            expect(nameIssue?.message).toBe(
                "El nombre del repositorio solo puede contener caracteres alfanuméricos, guiones, puntos o guiones bajos"
            );
            expect(nameIssue).toBeDefined();
        }
    });

    it("debería fallar cuando name tiene menos de 3 caracteres", () => {
        const result = createRepoInputSchema.safeParse({
            name: "ab",    // edge: límite mínimo es 3
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const nameIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "name"
            );
            expect(nameIssue?.message).toBe(
                "El nombre del repositorio debe tener al menos 3 caracteres"
            );
            expect(nameIssue).toBeDefined();
        }
    });

    it("debería aceptar name de solo 3 caracteres y sin campos opcionales", () => {
        const result = createRepoInputSchema.safeParse({
            name: "aaa",    // name válido, resto omitido
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.description).toBeUndefined();
            expect(result.data.private).toBeUndefined();
            expect(result.data.auto_init).toBeUndefined();
        }
    });
});
