import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { createIssueInputSchema, createIssueSchema } from "../schemas/create-issue.schema.js";
import { fail, ok } from "../utils/result.js";
import { createOctokit } from "../github/client.js";
import { IssueDto } from "../utils/types.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { logger } from "../utils/logger.js";
import { createIssue } from "../github/operations.js";

export async function createIssueHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[create_issue] Input recibido:", raw);

    const parsed = createIssueInputSchema.safeParse(raw);

    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[create_issue] Input inválido`, valErr.details);
        return fail(valErr.code, valErr.message, valErr.details);
    }

    const { owner, repo, title, body } = parsed.data;

    try {
        const data = await createIssue(octokit, {
            owner,
            repo,
            title,
            body: body ?? "",
        });

        const issue: IssueDto = {
            number: data.number,
            title: data.title,
            url: data.url,
            state: data.state,
        };

        logger.info("[create_issue] Respuesta generada exitosamente:", issue);
        return ok(issue);
    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[create_issue] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const createIssueTool = {
    name: 'create_issue' as const,
    description: "Crea un nuevo issue en un repositorio de GitHub especificando propietario, repositorio, título y cuerpo opcional en Markdown. Retorna número del issue, título, URL y estado ('open'). No edita issues existentes.",
    schema: createIssueSchema,
    handler: (raw: unknown) => createIssueHandler(raw),
};