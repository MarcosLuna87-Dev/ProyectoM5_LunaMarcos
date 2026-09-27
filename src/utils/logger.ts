/**
 * Redacta información sensible como tokens de GitHub y credenciales en mensajes y objetos.
 */
export function sanitize(input: unknown): string {
    if (input === null || input === undefined) return "";
    let str: string;
    if (typeof input === "string") {
        str = input;
    } else if (input instanceof Error) {
        str = `${input.name}: ${input.message}`;
    } else {
        try {
            str = JSON.stringify(input, null, 2);
        } catch {
            str = String(input);
        }
    }

    // Redactar GitHub Personal Access Tokens (ghp_, gho_, ghu_, ghs_, ghr_, github_pat_)
    str = str.replace(/(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}/gi, "[REDACTED_TOKEN]");
    str = str.replace(/github_pat_[A-Za-z0-9_]{36,255}/gi, "[REDACTED_TOKEN]");

    // Redactar Headers Authorization / Bearer tokens
    str = str.replace(/(Authorization\s*:\s*)?Bearer\s+[A-Za-z0-9._-]+/gi, "$1Bearer [REDACTED_TOKEN]");

    // Redactar propiedades con tokens o credenciales en formato JSON / clave-valor
    str = str.replace(/(["']?(?:token|password|secret|key|GH_TOKEN|GITHUB_TOKEN)["']?\s*[:=]\s*["']?)[^"'\s,]+(["']?)/gi, "$1[REDACTED]$2");
    str = str.replace(/(["']?authorization["']?\s*[:=]\s*["']?)(?!Bearer\b)[^"'\s,]+(["']?)/gi, "$1[REDACTED]$2");

    return str;
}

export const logger = {
    info(message: string, meta?: unknown) {
        const text = meta !== undefined ? `${message} ${sanitize(meta)}` : message;
        console.error(`[INFO] ${sanitize(text)}\n`);
    },
    warn(message: string, meta?: unknown) {
        const text = meta !== undefined ? `${message} ${sanitize(meta)}` : message;
        console.error(`[WARN] ${sanitize(text)}\n`);
    },
    error(message: string, error?: unknown) {
        const text = error !== undefined ? `${message} ${sanitize(error)}` : message;
        console.error(`[ERROR] ${sanitize(text)}\n`);
    },
    debug(message: string, meta?: unknown) {
        if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
            const text = meta !== undefined ? `${message} ${sanitize(meta)}` : message;
            console.error(`[DEBUG] ${sanitize(text)}\n`);
        }
    },
};
