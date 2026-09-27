import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { createFileInputSchema, createFileSchema } from "../schemas/create-file.schema.js";
import { fail, ok } from "../utils/result.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { createOctokit } from "../github/client.js";
import { logger } from "../utils/logger.js";
import { createFile } from "../github/operations.js";

export async function createFileHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[create_file] Input recibido:", raw);

    const parsed = createFileInputSchema.safeParse(raw);
    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[create_file] Input inválido`, valErr.details);
        return fail(valErr.code, valErr.message, valErr.details);
    }

    const { content, message, owner, path, repo, branch } = parsed.data;

    try {
        const result = await createFile(octokit, {
            owner,
            repo,
            path,
            content,
            message,
            branch: branch ?? "main",
        });

        logger.info("[create_file] Respuesta generada exitosamente:", result);
        return ok(result);
    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[create_file] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const createFileTool = {
    name: 'create_file' as const,
    description: "Crea o sobreescribe un archivo de texto en un repositorio de GitHub y genera un commit en la rama indicada (por defecto 'main'). Retorna el SHA del commit, URL y rutas modificadas. No lee archivos (usar get_file_content).",
    schema: createFileSchema,
    handler: (raw: unknown) => createFileHandler(raw),
};