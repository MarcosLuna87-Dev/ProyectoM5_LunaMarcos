function header(error: unknown, name: string): string | undefined {
    const headers = (error as { headers?: Record<string, string> }).headers;
    if (!headers) return undefined;
    return headers[name] ?? headers[name.toLocaleLowerCase()];
}

export function isRateLimited(error: unknown, status?: number): boolean {
    if (status === 429) return true;
    return status === 403 && header(error, "x-ratelimit-remaining") === "0";
}

// ------------------------------------------------------------------
// Clases de Errores Personalizados
// ------------------------------------------------------------------

export abstract class AppError extends Error {
    abstract readonly code: string;
    readonly details?: unknown;

    constructor(message: string, details?: unknown) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
        this.details = details;
    }
}

export class ValidationError extends AppError {
    readonly code = "INPUT_INVALIDO";
    constructor(message: string = "El input no cumple con el contrato. No se hizo el llamado a GitHub", details?: unknown) {
        super(message, details);
    }
}

export class AuthenticationError extends AppError {
    readonly code = "AUTHENTICATION_ERROR";
    constructor(message: string, details?: unknown) {
        super(message, details);
    }
}

export class GitHubAPIError extends AppError {
    readonly code = "GITHUB_ERROR";
    readonly status?: number | undefined;
    readonly isRateLimit: boolean;

    constructor(message: string, status?: number, isRateLimit: boolean = false, details?: unknown) {
        super(message, details);
        this.status = status;
        this.isRateLimit = isRateLimit;
    }
}

export class NetworkError extends AppError {
    readonly code = "NETWORK_ERROR";
    constructor(message: string = "Error de conexión de red al comunicarse con GitHub", details?: unknown) {
        super(message, details);
    }
}

export function isNetworkError(error: unknown): boolean {
    if (error instanceof NetworkError) {
        return true;
    }

    const errObj = error as {
        code?: string;
        message?: string;
        cause?: { code?: string; message?: string };
    };

    const code = errObj?.code ?? errObj?.cause?.code;
    const message = errObj?.message ?? errObj?.cause?.message;

    if (
        code === "ENOTFOUND" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "ECONNRESET" ||
        code === "EAI_AGAIN" ||
        code === "UND_ERR_CONNECT_TIMEOUT" ||
        code === "EHOSTUNREACH" ||
        code === "ENETUNREACH" ||
        code === "EPIPE"
    ) {
        return true;
    }

    if (message && /fetch failed|network|getaddrinfo|socket hang up|timeout/i.test(message)) {
        return true;
    }

    return false;
}

// ------------------------------------------------------------------
// Normalización de Errores (Clasificación por tipo custom)
// ------------------------------------------------------------------

export function normalizeError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error;
    }

    const errObj = error as { status?: number; code?: string; message?: string };
    const status = errObj?.status;
    const errCode = errObj?.code;

    // Errores de Red (DNS, ECONNREFUSED, fetch failed, etc.)
    if (isNetworkError(error)) {
        const code =
            (error as { code?: string; cause?: { code?: string } })?.code ??
            (error as { cause?: { code?: string } })?.cause?.code;
        return new NetworkError(
            `Error de conexión de red (${code || "NETWORK_FAIL"}): No se pudo contactar con GitHub`,
            error,
        );
    }

    if (status === 401) {
        return new AuthenticationError(
            "Token invalido (401). Revisá GITHUB_TOKEN en el .env",
            error,
        );
    }

    if (isRateLimited(error, status)) {
        return new GitHubAPIError(
            "Ratelimit de GitHub (403/429). Espere el reset de la API",
            status,
            true,
            error,
        );
    }

    if (status === 403) {
        return new AuthenticationError(
            "Acceso denegado o rate limit (403). Revisá permisos del token, O espera unos minutos y vuelve a intentar.",
            error,
        );
    }

    if (status === 404) {
        return new GitHubAPIError(
            "No se encontró el recurso (404). Revisá owner, repo, username o issue_number.",
            status,
            false,
            error,
        );
    }

    if (status === 422) {
        return new GitHubAPIError(
            "GitHub rechazó los datos (422). Revisá título/estado o si el repo tiene issues habilitados.",
            status,
            false,
            error,
        );
    }

    const msg = errObj?.message ? `Error inesperado: ${errObj.message}` : "Error inesperado en la llamada a GitHub";
    return new GitHubAPIError(msg, status, false, error);
}

// Mensajes accionables. Se debe saber que corregir, no solo el status.
export function messageFor(error: unknown): string {
    return normalizeError(error).message;
}