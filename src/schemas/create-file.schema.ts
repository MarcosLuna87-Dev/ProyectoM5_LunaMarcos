import { z } from "zod";
import { owner, repo, path, branch } from "./index.js";

export const createFileSchema = {
    owner,
    repo,
    path,

    content: z
        .string()
        .describe("Contenido en texto plano que se escribirá en el archivo"),

    message: z
        .string()
        .trim()
        .min(1, "El mensaje de commit es requerido")
        .describe("Mensaje descriptivo que identificará el commit"),

    branch,
};

export const createFileInputSchema = z.object(createFileSchema);

export type CreateFileInput = z.infer<typeof createFileInputSchema>;