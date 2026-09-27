import { describe, it, expect } from "vitest";
import {
    messageFor,
    isRateLimited,
    isNetworkError,
    normalizeError,
    ValidationError,
    GitHubAPIError,
    AuthenticationError,
    NetworkError,
} from "../../src/errors/errors.js";
import { sanitize } from "../../src/utils/logger.js";

// Helper para construir errores con status y headers opcionales
function httpError(
    status: number,
    headers?: Record<string, string>,
): unknown {
    return Object.assign(new Error(`HTTP ${status}`), { status, headers });
}

describe("messageFor", () => {
    it("retorna mensaje de token inválido para error 401", () => {
        expect(messageFor(httpError(401))).toBe(
            "Token invalido (401). Revisá GITHUB_TOKEN en el .env",
        );
    });

    it("retorna mensaje de ratelimit para error 429", () => {
        expect(messageFor(httpError(429))).toBe(
            "Ratelimit de GitHub (403/429). Espere el reset de la API",
        );
    });

    it("retorna mensaje de ratelimit para 403 con header x-ratelimit-remaining: 0", () => {
        const error = httpError(403, { "x-ratelimit-remaining": "0" });

        expect(messageFor(error)).toBe(
            "Ratelimit de GitHub (403/429). Espere el reset de la API",
        );
    });

    it("retorna mensaje de acceso denegado para 403 sin header de ratelimit", () => {
        expect(messageFor(httpError(403))).toBe(
            "Acceso denegado o rate limit (403). Revisá permisos del token, O espera unos minutos y vuelve a intentar.",
        );
    });

    it("retorna mensaje de recurso no encontrado para error 404", () => {
        expect(messageFor(httpError(404))).toBe(
            "No se encontró el recurso (404). Revisá owner, repo, username o issue_number.",
        );
    });

    it("retorna mensaje de datos rechazados para error 422", () => {
        expect(messageFor(httpError(422))).toBe(
            "GitHub rechazó los datos (422). Revisá título/estado o si el repo tiene issues habilitados.",
        );
    });

    it("retorna mensaje genérico para errores desconocidos", () => {
        const error = new Error("algo salió mal");

        expect(messageFor(error)).toBe("Error inesperado: algo salió mal");
    });
});

describe("isRateLimited", () => {
    it("retorna true para status 429", () => {
        expect(isRateLimited(httpError(429), 429)).toBe(true);
    });

    it("retorna true para status 403 con header x-ratelimit-remaining igual a 0", () => {
        const error = httpError(403, { "x-ratelimit-remaining": "0" });

        expect(isRateLimited(error, 403)).toBe(true);
    });

    it("retorna false para status 403 sin header de ratelimit", () => {
        expect(isRateLimited(httpError(403), 403)).toBe(false);
    });

    it("retorna false para status 403 con remaining mayor a 0", () => {
        const error = httpError(403, { "x-ratelimit-remaining": "5" });

        expect(isRateLimited(error, 403)).toBe(false);
    });

    it("retorna false para status 401", () => {
        expect(isRateLimited(httpError(401), 401)).toBe(false);
    });
});

describe("isNetworkError", () => {
    it("retorna true para error con código de red estándar (ENOTFOUND, ECONNREFUSED, ETIMEDOUT, ECONNRESET)", () => {
        expect(isNetworkError(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }))).toBe(true);
        expect(isNetworkError(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }))).toBe(true);
        expect(isNetworkError(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }))).toBe(true);
        expect(isNetworkError(Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }))).toBe(true);
    });

    it("retorna true para error con código en cause (Node fetch standard)", () => {
        const errorWithCause = Object.assign(new TypeError("fetch failed"), {
            cause: { code: "ECONNREFUSED" },
        });
        expect(isNetworkError(errorWithCause)).toBe(true);
    });

    it("retorna true para mensaje que indica fallo de red", () => {
        expect(isNetworkError(new TypeError("fetch failed"))).toBe(true);
        expect(isNetworkError(new Error("network error occurred"))).toBe(true);
        expect(isNetworkError(new Error("socket hang up"))).toBe(true);
    });

    it("retorna true para instancias de NetworkError", () => {
        expect(isNetworkError(new NetworkError())).toBe(true);
    });

    it("retorna false para errores HTTP y de negocio (401, 404, validación)", () => {
        expect(isNetworkError(httpError(401))).toBe(false);
        expect(isNetworkError(httpError(404))).toBe(false);
        expect(isNetworkError(new ValidationError())).toBe(false);
        expect(isNetworkError(new Error("algo inesperado pero no de red"))).toBe(false);
    });
});

describe("Clases de Errores Custom y Normalización", () => {
    it("clasifica error 401 como AuthenticationError", () => {
        const normalized = normalizeError(httpError(401));
        expect(normalized).toBeInstanceOf(AuthenticationError);
        expect(normalized.code).toBe("AUTHENTICATION_ERROR");
    });

    it("clasifica error 404 como GitHubAPIError", () => {
        const normalized = normalizeError(httpError(404));
        expect(normalized).toBeInstanceOf(GitHubAPIError);
        expect(normalized.code).toBe("GITHUB_ERROR");
        expect((normalized as GitHubAPIError).status).toBe(404);
    });

    it("clasifica error 429/rate limit como GitHubAPIError con isRateLimit = true", () => {
        const normalized = normalizeError(httpError(429));
        expect(normalized).toBeInstanceOf(GitHubAPIError);
        expect((normalized as GitHubAPIError).isRateLimit).toBe(true);
    });

    it("clasifica error de red como NetworkError", () => {
        const netErr = Object.assign(new Error("fetch failed"), { code: "ENOTFOUND" });
        const normalized = normalizeError(netErr);
        expect(normalized).toBeInstanceOf(NetworkError);
        expect(normalized.code).toBe("NETWORK_ERROR");
    });

    it("crea ValidationError para validaciones de input", () => {
        const valErr = new ValidationError("Input inválido", { field: "owner" });
        expect(valErr.code).toBe("INPUT_INVALIDO");
        expect(valErr.details).toEqual({ field: "owner" });
    });
});

describe("Sanitize / Logging seguro sin tokens", () => {
    it("redacta tokens ghp_ en logs", () => {
        const text = "Error usando token ghp_1234567890abcdefghijklmnopqrstuvwxyz";
        expect(sanitize(text)).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyz");
        expect(sanitize(text)).toContain("[REDACTED_TOKEN]");
    });

    it("redacta tokens github_pat_ en logs", () => {
        const text = "Error usando token github_pat_11AAAAAAA_bbbbbbbbbbbbbbbbbbbbbbbbbb";
        expect(sanitize(text)).not.toContain("github_pat_11AAAAAAA_bbbbbbbbbbbbbbbbbbbbbbbbbb");
        expect(sanitize(text)).toContain("[REDACTED_TOKEN]");
    });

    it("redacta headers Bearer", () => {
        const text = "Authorization: Bearer mySecretToken123";
        expect(sanitize(text)).not.toContain("mySecretToken123");
        expect(sanitize(text)).toContain("Bearer [REDACTED_TOKEN]");
    });
});
