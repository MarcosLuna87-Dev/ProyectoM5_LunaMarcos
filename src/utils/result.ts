export function ok(data: unknown) {
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify({ ok: true, data }, null, 2),
            },
        ],
    };
}

export function fail(
    code: string,
    message: string,
    details?: unknown,
) {
    return {
        isError: true,
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(
                    { ok: false, error: { code, message, details } },
                    null,
                    2,
                ),
            },
        ],
    };
}