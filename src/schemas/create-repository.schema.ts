import { z } from "zod";

export const createRepoSchema = {
    name: z
        .string()
        .trim()
        .min(3, "El nombre del repositorio debe tener al menos 3 caracteres")
        .max(100, "El nombre del repositorio no puede exceder los 100 caracteres")
        .regex(
            /^[a-zA-Z0-9_.-]+$/,
            "El nombre del repositorio solo puede contener caracteres alfanuméricos, guiones, puntos o guiones bajos"
        )
        .describe("Nombre del repositorio a crear en GitHub (3 a 100 caracteres). El nombre del repositorio solo puede contener caracteres alfanuméricos, guiones, puntos o guiones bajos"),
    description: z
        .string()
        .trim()
        .max(350, "La descripción no puede superar los 350 caracteres")
        .optional()
        .describe("Descripción opcional del repositorio (máx. 350 caracteres)"),
    private: z
        .boolean()
        .optional()
        .describe("Indica si el repositorio debe ser privado (opcional, por defecto false)"),
    auto_init: z
        .boolean()
        .optional()
        .describe("Inicializa el repositorio con un commit inicial y README (opcional, por defecto true)"),
};

export const createRepoInputSchema = z.object(createRepoSchema);

export type CreateRepoInput = z.infer<typeof createRepoInputSchema>;

