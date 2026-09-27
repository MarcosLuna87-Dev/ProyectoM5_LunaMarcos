import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { addCommentToIssueInputSchema, addCommentToIssueSchema } from "../schemas/add-comment-to-issue.schema.js";
import { fail, ok } from "../utils/result.js";
import { createOctokit } from "../github/client.js";
import { IssueCommentDto } from "../utils/types.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { logger } from "../utils/logger.js";
import { addCommentToIssue } from "../github/operations.js";

export async function addCommentToIssueHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[add_comment_to_issue] Input recibido:", raw);

    const parsed = addCommentToIssueInputSchema.safeParse(raw);

    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[add_comment_to_issue] Input inválido`, valErr.details);
        return fail(valErr.code, valErr.message, valErr.details);
    }

    const { owner, repo, issue_number, body } = parsed.data;

    try {
        const data = await addCommentToIssue(octokit, {
            owner,
            repo,
            issue_number,
            body,
        });

        const comment: IssueCommentDto = {
            id: data.id,
            url: data.html_url,
            body: data.body ?? "",
        };

        logger.info("[add_comment_to_issue] Respuesta generada exitosamente:", comment);
        return ok(comment);
    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[add_comment_to_issue] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const addCommentToIssueTool = {
    name: "add_comment_to_issue" as const,
    description: "Agrega un nuevo comentario a un issue existente en un repositorio de GitHub especificando propietario, repositorio, número de issue y contenido en Markdown. Retorna los datos del comentario (ID, URL y cuerpo).",
    schema: addCommentToIssueSchema,
    handler: (raw: unknown) => addCommentToIssueHandler(raw),
};
