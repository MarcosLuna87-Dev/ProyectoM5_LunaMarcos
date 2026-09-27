import { z } from "zod";
import { owner, repo } from "./index.js";

export const createIssueSchema = {
    owner,
    repo,

    title: z
        .string()
        .trim()
        .min(1, "El título del issue es requerido")
        .max(256, "El título no puede exceder los 256 caracteres")
        .describe("Título descriptivo del nuevo issue a crear"),

    body: z
        .string()
        .optional()
        .describe(
            "Cuerpo o descripción detallada del issue en formato Markdown (opcional)",
        ),
};

export const createIssueInputSchema = z.object(createIssueSchema);

export type CreateIssueInput = z.infer<typeof createIssueInputSchema>;