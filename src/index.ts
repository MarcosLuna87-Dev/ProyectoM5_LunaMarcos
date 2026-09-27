import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./utils/server.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
    const server = createServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    logger.info("Servidor github-mcp conectado via STDIO");
}

main().catch((error: unknown) => {
    logger.error("Error al iniciar el servidor MCP:", error);
    process.exit(1);
});