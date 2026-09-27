import { z } from "zod";
import { owner, repo, issue_number } from "./index.js";

export const addCommentToIssueSchema = {
    owner,
    repo,
    issue_number,

    body: z
        .string()
        .trim()
        .min(1, "El contenido del comentario es requerido")
        .describe("Contenido o cuerpo del comentario en formato Markdown"),
};

export const addCommentToIssueInputSchema = z.object(addCommentToIssueSchema);

export type AddCommentToIssueInput = z.infer<typeof addCommentToIssueInputSchema>;
