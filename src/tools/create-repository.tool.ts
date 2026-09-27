import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { createRepoInputSchema, createRepoSchema } from "../schemas/create-repository.schema.js";
import { fail, ok } from "../utils/result.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { createOctokit } from "../github/client.js";
import { CreateRepoDto } from "../utils/types.js";
import { logger } from "../utils/logger.js";
import { createRepository } from "../github/operations.js";

export async function createRepoHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[create_repo] Input recibido:", raw);

    const parsed = createRepoInputSchema.safeParse(raw);

    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[create_repo] Input inválido`, valErr.details);
        return fail(valErr.code, valErr.message, valErr.details);
    }

    const { name, description, private: isPrivate, auto_init } = parsed.data;

    try {
        const data = await createRepository(octokit, {
            name,
            description: description ?? "",
            private: isPrivate ?? false,
            auto_init: auto_init ?? true,
        });

        const repo: CreateRepoDto = {
            name: data.name,
            fullName: data.full_name,
            url: data.html_url,
            description: data.description ?? null,
            private: data.private,
        };

        logger.info("[create_repo] Respuesta generada exitosamente:", repo);
        return ok(repo);

    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[create_repo] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const createRepoTool = {
    name: 'create_repo' as const,
    description: "Crea un nuevo repositorio en la cuenta del usuario autenticado en GitHub. Permite configurar nombre, descripción, visibilidad (público/privado) e inicialización con commit y README. Retorna name, fullName, url, description y visibilidad.",
    schema: createRepoSchema,
    handler: (raw: unknown) => createRepoHandler(raw),
};