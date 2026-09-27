import { isNetworkError, isRateLimited } from "../errors/errors.js";
import { logger } from "./logger.js";

export interface RetryOptions {
    /** Cantidad máxima de reintentos (default: 3) */
    retries?: number;
    /** Delay base en ms para el backoff exponencial (default: 500) */
    baseDelayMs?: number;
}

/**
 * Ejecuta `fn` con retry y exponential backoff.
 * Reintenta si el error es por rate limit (403 + x-ratelimit-remaining: 0, o 429)
 * o por caídas transitorias de red (ENOTFOUND, ECONNRESET, ETIMEDOUT, etc.).
 * Errores como 401, 404, 422 se propagan inmediatamente sin reintentar.
 *
 * Delays: 500ms → 1000ms → 2000ms (con retries=3)
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const { retries = 3, baseDelayMs = 500 } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const status = (error as { status?: number }).status;
            const rateLimited = isRateLimited(error, status);
            const networkError = isNetworkError(error);

            // Errores que no tiene sentido reintentar (auth, datos inválidos, etc.)
            if (!rateLimited && !networkError) {
                throw error;
            }

            // Último intento agotado
            if (attempt === retries) {
                const motivo = rateLimited
                    ? "alcanzar el Rate Limit de GitHub"
                    : "caídas transitorias de red con GitHub";
                logger.error(`Se agotaron los reintentos tras ${motivo}`, error);
                throw error;
            }

            const delayMs = baseDelayMs * 2 ** attempt; // 500 → 1000 → 2000ms
            const motivo = rateLimited
                ? `Rate limit alcanzado en GitHub (status ${status})`
                : `Caída transitoria de red detectada al comunicarse con GitHub`;
            logger.warn(`${motivo}. Reintento ${attempt + 1}/${retries} programado en ${delayMs}ms (evitando loop inmediato)...`);
            await sleep(delayMs);
        }
    }

    throw new Error("withRetry: estado inalcanzable");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
