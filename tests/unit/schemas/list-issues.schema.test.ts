import { describe, it, expect } from "vitest";
import { listIssuesInputSchema } from "../../../src/schemas/list-issues.schema.js";

describe("listIssuesInputSchema - safeParse edge cases", () => {

    it("debería fallar cuando per_page es 0 (bajo el mínimo de 1)", () => {
        const result = listIssuesInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            per_page: 0,    // edge: límite inferior es 1
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const perPageIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "per_page"
            );
            expect(perPageIssue?.message).toBe("La cantidad mínima de issues a devolver es 1");
            expect(perPageIssue).toBeDefined();
        }
    });

    it("debería fallar cuando per_page es 101 (supera el máximo de 100)", () => {
        const result = listIssuesInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            per_page: 101,  // edge: exactamente 1 más del límite
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const perPageIssue = result.error.issues.find(
                (iss) => iss.path?.[0] === "per_page"
            );
            expect(perPageIssue?.message).toBe("La cantidad máxima de issues a devolver es 100");
            expect(perPageIssue).toBeDefined();
        }
    });

    it("debería parsear correctamente cuando per_page es 100", () => {
        const result = listIssuesInputSchema.safeParse({
            owner: "usuario",
            repo: "mi-repo",
            per_page: 100,
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.per_page).toBe(100);
        }
    });
});
