import * as z from "zod";
import type { Octokit } from "@octokit/rest";
import { createLabelInputSchema, createLabelSchema } from "../schemas/create-label.schema.js";
import { fail, ok } from "../utils/result.js";
import { createOctokit } from "../github/client.js";
import { LabelDto } from "../utils/types.js";
import { normalizeError, ValidationError } from "../errors/errors.js";
import { logger } from "../utils/logger.js";
import { createLabel } from "../github/operations.js";

export async function createLabelHandler(
    raw: unknown,
    octokit: Octokit = createOctokit(),
) {
    logger.info("[create_label] Input recibido:", raw);

    const parsed = createLabelInputSchema.safeParse(raw);

    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error);
        const valErr = new ValidationError("El input no cumple con el contrato. No se hizo el llamado a GitHub", flattened.fieldErrors);
        logger.warn(`[create_label] Input inválido`, valErr.details);
        return fail(valErr.code, valErr.message, valErr.details);
    }

    const { owner, repo, name, color, description } = parsed.data;

    const formattedColor = color ? color.replace(/^#/, "") : "f29513";

    try {
        const data = await createLabel(octokit, {
            owner,
            repo,
            name,
            color: formattedColor,
            description: description ?? "",
        });

        const label: LabelDto = {
            id: data.id,
            name: data.name,
            color: data.color,
            description: data.description ?? null,
        };

        logger.info("[create_label] Respuesta generada exitosamente:", label);
        return ok(label);
    } catch (error) {
        const appErr = normalizeError(error);
        logger.error(`[create_label] Error al ejecutar la tool`, appErr);
        return fail(appErr.code, appErr.message);
    }
}

export const createLabelTool = {
    name: "create_label" as const,
    description: "Crea una nueva etiqueta (label) personalizada en un repositorio de GitHub especificando propietario, repositorio, nombre y opcionalmente color hexadecimal y descripción. Retorna los datos de la etiqueta (ID, nombre, color y descripción).",
    schema: createLabelSchema,
    handler: (raw: unknown) => createLabelHandler(raw),
};
