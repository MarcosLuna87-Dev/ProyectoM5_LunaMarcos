import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { closeIssueInputSchema, closeIssueSchema } from "../schemas/close-issue.schema.js";
import { fail, ok } from "../utils/result.js";
import { createOctokit } from "../github/client.js";
import { IssueDto } from "../utils/types.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { logger } from "../utils/logger.js";
import { closeIssue } from "../github/operations.js";

export async function closeIssueHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[close_issue] Input recibido:", raw);

    const parsed = closeIssueInputSchema.safeParse(raw);

    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[close_issue] Input inválido`, valErr.details);
        return fail(valErr.code, valErr.message, valErr.details);
    }

    const { owner, repo, issue_number } = parsed.data;

    try {
        const data = await closeIssue(octokit, {
            owner,
            repo,
            issue_number,
        });

        const issue: IssueDto = {
            number: data.number,
            title: data.title,
            url: data.html_url,
            state: data.state,
        };

        logger.info("[close_issue] Respuesta generada exitosamente:", issue);
        return ok(issue);
    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[close_issue] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const closeIssueTool = {
    name: "close_issue" as const,
    description: "Cierra un issue específico en un repositorio de GitHub indicando propietario, repositorio y número de issue. Cambia su estado a 'closed' y retorna los datos del issue (número, título, URL y estado).",
    schema: closeIssueSchema,
    handler: (raw: unknown) => closeIssueHandler(raw),
};
