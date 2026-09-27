import { z } from "zod";
import { owner, repo } from "./index.js";

export const createLabelSchema = {
    owner,
    repo,

    name: z
        .string()
        .trim()
        .min(1, "El nombre de la etiqueta es requerido")
        .max(50, "El nombre de la etiqueta no puede exceder los 50 caracteres")
        .describe("Nombre de la etiqueta o label a crear"),

    color: z
        .string()
        .trim()
        .regex(
            /^#?[0-9a-fA-F]{6}$/,
            "El color debe ser un código hexadecimal de 6 dígitos (ej: 'ff0000' o '#ff0000')",
        )
        .optional()
        .describe(
            "Código de color hexadecimal de 6 caracteres (ej: 'f29513' o '#f29513') (opcional)",
        ),

    description: z
        .string()
        .trim()
        .optional()
        .describe("Descripción opcional de la etiqueta"),
};

export const createLabelInputSchema = z.object(createLabelSchema);

export type CreateLabelInput = z.infer<typeof createLabelInputSchema>;
