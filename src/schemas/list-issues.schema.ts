import { z } from "zod";
import { owner, repo } from "./index.js";

export const listIssuesSchema = {
    owner,
    repo,

    per_page: z
        .number()
        .int("La cantidad de issues debe ser un número entero")
        .min(1, "La cantidad mínima de issues a devolver es 1")
        .max(100, "La cantidad máxima de issues a devolver es 100")
        .optional()
        .describe(
            "Cantidad máxima de issues a devolver (1 a 100). Por defecto su valor es 30.",
        ),
};

export const listIssuesInputSchema = z.object(listIssuesSchema);

export type ListIssuesInput = z.infer<typeof listIssuesInputSchema>;