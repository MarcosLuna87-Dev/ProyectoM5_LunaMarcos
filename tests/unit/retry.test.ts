import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../src/utils/retry";

// Helper para construir errores con status HTTP
function httpError(status: number): Error {
    return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe("withRetry", () => {
    it("retorna el valor de fn en el primer intento exitoso", async () => {
        const fn = vi.fn().mockResolvedValue("éxito");

        const result = await withRetry(fn);

        expect(result).toBe("éxito");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("propaga inmediatamente un error no retryable (401) sin reintentar", async () => {
        const fn = vi.fn().mockRejectedValue(httpError(401));

        await expect(withRetry(fn)).rejects.toMatchObject({ status: 401 });

        // No reintenta errores de auth → llamado exactamente una vez
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("reintenta en error 429 y tiene éxito al segundo intento", async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(httpError(429))
            .mockResolvedValueOnce("éxito tras retry");

        vi.useFakeTimers();
        try {
            const promise = withRetry(fn, { retries: 3 });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe("éxito tras retry");
            expect(fn).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("lanza el error después de agotar todos los reintentos", async () => {
        const fn = vi.fn().mockRejectedValue(httpError(429));

        vi.useFakeTimers();
        try {
            // El handler de rechazo debe adjuntarse ANTES de correr los timers
            // para evitar UnhandledPromiseRejection
            const assertion = expect(
                withRetry(fn, { retries: 2 }),
            ).rejects.toMatchObject({ status: 429 });

            await vi.runAllTimersAsync();
            await assertion;

            // 1 intento inicial + 2 reintentos = 3 llamadas en total
            expect(fn).toHaveBeenCalledTimes(3);
        } finally {
            vi.useRealTimers();
        }
    });

    it("aplica backoff exponencial: los delays crecen con cada reintento", async () => {
        // useFakeTimers ANTES de spyOn: el spy debe capturar el setTimeout fake,
        // no el real (que ya fue reemplazado por useFakeTimers)
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

        try {
            const fn = vi.fn()
                .mockRejectedValueOnce(httpError(429))
                .mockRejectedValueOnce(httpError(429))
                .mockResolvedValueOnce("ok");

            const promise = withRetry(fn, { retries: 3, baseDelayMs: 100 });
            await vi.runAllTimersAsync();
            await promise;

            // Primer delay: 100ms (100 * 2^0), segundo: 200ms (100 * 2^1)
            expect(setTimeoutSpy).toHaveBeenNthCalledWith(
                1,
                expect.any(Function),
                100,
            );
            expect(setTimeoutSpy).toHaveBeenNthCalledWith(
                2,
                expect.any(Function),
                200,
            );
        } finally {
            setTimeoutSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it("reintenta ante caídas transitorias de red (ECONNRESET) y tiene éxito al segundo intento", async () => {
        const netError = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
        const fn = vi.fn()
            .mockRejectedValueOnce(netError)
            .mockResolvedValueOnce("éxito tras retry de red");

        vi.useFakeTimers();
        try {
            const promise = withRetry(fn, { retries: 3 });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe("éxito tras retry de red");
            expect(fn).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("reintenta ante error de tipo TypeError 'fetch failed' y tiene éxito", async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new TypeError("fetch failed"))
            .mockResolvedValueOnce("recuperado de fetch failed");

        vi.useFakeTimers();
        try {
            const promise = withRetry(fn, { retries: 2 });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe("recuperado de fetch failed");
            expect(fn).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("lanza el error de red después de agotar todos los reintentos", async () => {
        const netError = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
        const fn = vi.fn().mockRejectedValue(netError);

        vi.useFakeTimers();
        try {
            const assertion = expect(
                withRetry(fn, { retries: 2 }),
            ).rejects.toMatchObject({ code: "ETIMEDOUT" });

            await vi.runAllTimersAsync();
            await assertion;

            // 1 intento inicial + 2 reintentos = 3 llamadas
            expect(fn).toHaveBeenCalledTimes(3);
        } finally {
            vi.useRealTimers();
        }
    });
});
