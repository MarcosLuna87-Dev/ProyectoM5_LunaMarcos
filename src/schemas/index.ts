import { z } from "zod";

export const owner = z
    .string()
    .trim()
    .min(1, "El dueño del repositorio es requerido")
    .max(
        39,
        "El nombre de usuario u organización no puede exceder los 39 caracteres",
    )
    .describe(
        "Usuario u organización de GitHub propietaria del repositorio",
    );

export const repo = z
    .string()
    .trim()
    .min(1, "El nombre del repositorio es requerido")
    .max(
        100,
        "El nombre del repositorio no puede exceder los 100 caracteres",
    )
    .regex(
        /^[a-zA-Z0-9_.-]+$/,
        "El nombre del repositorio solo puede contener caracteres alfanuméricos, guiones, puntos o guiones bajos",
    )
    .describe("Nombre del repositorio en GitHub");

export const path = z
    .string()
    .trim()
    .min(1, "La ruta del archivo es requerida")
    .refine((p) => !p.startsWith("/"), {
        message:
            "La ruta debe ser relativa al repositorio y no debe iniciar con '/'",
    })
    .describe(
        "Ruta relativa del archivo dentro del repositorio (ej: 'README.md', 'src/index.ts')",
    );

export const branch = z
    .string()
    .trim()
    .min(1, "El nombre de la rama no puede estar vacío")
    .optional()
    .describe("Rama donde se realizará la operación (opcional, por defecto 'main')");

export const issue_number = z
    .number()
    .int("El número del issue debe ser un entero")
    .positive("El número del issue debe ser mayor a 0")
    .describe("Número identificador del issue en GitHub");