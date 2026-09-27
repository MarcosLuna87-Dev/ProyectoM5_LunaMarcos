import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { getFileContentInputSchema, getFileContentSchema } from "../schemas/get-file-content.schema.js";
import { fail, ok } from "../utils/result.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { createOctokit } from "../github/client.js";
import { FileContentDto } from "../utils/types.js";
import { logger } from "../utils/logger.js";
import { getFileContent } from "../github/operations.js";

export async function getFileContentHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[get_file_content] Input recibido:", raw);

    const parsed = getFileContentInputSchema.safeParse(raw);

    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[get_file_content] Input inválido`, valErr.details);
        return fail(valErr.code, valErr.message, valErr.details);
    }

    const { owner, repo, path, branch } = parsed.data;
    try {
        const data = await getFileContent(octokit, {
            owner,
            repo,
            path,
            ref: branch ?? "main",
        });

        if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
            logger.warn(`[get_file_content] La ruta ${path} no corresponde a un archivo de texto`);
            return fail("NOT_A_FILE", "La ruta indicada no corresponde a un archivo de texto válido");
        }

        const file: FileContentDto = {
            path: data.path,
            content: Buffer.from(data.content, 'base64').toString('utf-8'),
            sha: data.sha,
        };

        logger.info("[get_file_content] Respuesta generada exitosamente:", file);
        return ok(file);

    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[get_file_content] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const getFileContentTool = {
    name: 'get_file_content' as const,
    description: "Lee el contenido en texto plano de un archivo en un repositorio de GitHub (decodificado desde base64). Retorna path, content y sha. No crea ni modifica archivos (usar create_file).",
    schema: getFileContentSchema,
    handler: (raw: unknown) => getFileContentHandler(raw),
};
