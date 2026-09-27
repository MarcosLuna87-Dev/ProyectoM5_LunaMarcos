import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { fail, ok } from "../utils/result.js";
import { listRepositoriesInputSchema, listRepositoriesSchema } from "../schemas/list-repositories.schema.js";
import { createOctokit } from "../github/client.js";
import { ListRepoDto } from "../utils/types.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { logger } from "../utils/logger.js";
import { listRepositories } from "../github/operations.js";

export async function listRepositoriesHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[list_repositories] Input recibido:", raw);

    const parsed = listRepositoriesInputSchema.safeParse(raw);
    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[list_repositories] Input inválido`, valErr.details);
        return fail(
            valErr.code,
            valErr.message,
            valErr.details,
        );
    }

    const { type, per_page } = parsed.data;

    try {
        const data = await listRepositories(octokit, {
            type,
            per_page,
        });

        const repos: ListRepoDto[] = data.map((repo) => ({
            name: repo.name,
            fullName: repo.full_name,
            url: repo.html_url ?? repo.url,
            private: repo.private,
            stars: repo.stargazers_count ?? 0,
            language: repo.language ?? null,
        }));

        logger.info("[list_repositories] Respuesta generada exitosamente:", repos);
        return ok(repos);

    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[list_repositories] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const listRepositoriesTool = {
    name: 'list_repositories' as const,
    description: "Lista repositorios del usuario autenticado de GitHub. Permite filtrar por all, public, private y paginar la cantidad (per_page: 1 a 100, por defecto 10). Retorna name, fullName, url, private, stars y language. No lista issues ni pull requests.",
    schema: listRepositoriesSchema,
    handler: (raw: unknown) => listRepositoriesHandler(raw),
};