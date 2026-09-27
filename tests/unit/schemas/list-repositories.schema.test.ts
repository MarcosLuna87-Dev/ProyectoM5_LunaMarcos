import { describe, it, expect } from "vitest";
import { listRepositoriesInputSchema } from "../../../src/schemas/list-repositories.schema.js";

describe("listRepositoriesInputSchema - safeParse edge cases", () => {

    it("debería fallar cuando type tiene un valor fuera del enum permitido", () => {
        const result = listRepositoriesInputSchema.safeParse({
            type: "forks",   // edge: valor no permitido; solo acepta "all" | "public" | "private"
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            // buscar el issue del campo "type"
            const typeIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "type"
            );
            expect(typeIssue?.code).toBe(
                "invalid_value"
            );
            expect(typeIssue?.message).toBe(
                "El campo type solo puede ser: all, public o private."
            );
            expect(typeIssue).toBeDefined();
        }
    });

    it("debería fallar cuando per_page es un número decimal (no entero)", () => {
        const result = listRepositoriesInputSchema.safeParse({
            per_page: 5.5,   // edge: debe ser entero
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const perPageIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "per_page"
            );
            expect(perPageIssue?.message).toBe("La cantidad de repositorios debe ser un número entero");
            expect(perPageIssue).toBeDefined();
        }
    });

    it("debería aplicar el default 'all' para type cuando el campo se omite", () => {
        const result = listRepositoriesInputSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            // El schema define .default("all"), debe resolverse automáticamente
            expect(result.data.type).toBe("all");
        }
    });
});
