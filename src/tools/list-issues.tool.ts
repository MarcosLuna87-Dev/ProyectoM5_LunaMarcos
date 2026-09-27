import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { fail, ok } from "../utils/result.js";
import { listIssuesInputSchema, listIssuesSchema } from "../schemas/list-issues.schema.js";
import { createOctokit } from "../github/client.js";
import { IssueDto } from "../utils/types.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { logger } from "../utils/logger.js";
import { listIssues } from "../github/operations.js";

export async function listIssuesHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[list_issues] Input recibido:", raw);

    const parsed = listIssuesInputSchema.safeParse(raw);

    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[list_issues] Input inválido`, valErr.details);
        return fail(valErr.code, valErr.message, valErr.details);
    }

    const { owner, repo, per_page } = parsed.data;

    try {
        const data = await listIssues(octokit, {
            owner,
            repo,
            per_page: per_page ?? 30,
        });

        const issues: IssueDto[] = data
            .filter((issue) => !issue.pull_request)
            .map((issue) => ({
                number: issue.number,
                title: issue.title,
                url: issue.html_url,
                state: issue.state,
            }));

        logger.info("[list_issues] Respuesta generada exitosamente:", issues);
        return ok(issues);
    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[list_issues] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const listIssuesTool = {
    name: "list_issues" as const,
    description: "Lista los issues abiertos de un repositorio específico de GitHub especificando propietario y nombre del repositorio. Permite paginar la cantidad (per_page: 1 a 100, por defecto 30). Retorna número del issue, título, URL y estado ('open').",
    schema: listIssuesSchema,
    handler: (raw: unknown) => listIssuesHandler(raw),
};
