import { z } from "zod";

export const listRepositoriesSchema = {
    type: z
        .enum(["all", "public", "private"], {
            error: "El campo type solo puede ser: all, public o private.",
        })
        .default("all")
        .describe("Tipo de repos a listar (default: all)"),
    per_page: z
        .number()
        .int("La cantidad de repositorios debe ser un número entero")
        .min(1, "La cantidad mínima de repositorios a devolver es 1")
        .max(100, "La cantidad máxima de repositorios a devolver es 100")
        .default(10)
        .describe("Cantidad de repositorios a devolver, max 100). Por defecto su valor es 10."),
};

export const listRepositoriesInputSchema = z.object(listRepositoriesSchema);

export type ListRepositoriesInput = z.infer<typeof listRepositoriesInputSchema>;
