import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listRepositoriesTool } from "./list-repositories.tool.js";
import { createIssueTool } from "./create-issue.tool.js";
import { createRepoTool } from "./create-repository.tool.js";
import { createFileTool } from "./create-file.tool.js";
import { getFileContentTool } from "./get-file-content.tool.js";
import { listIssuesTool } from "./list-issues.tool.js";
import { closeIssueTool } from "./close-issue.tool.js";
import { addCommentToIssueTool } from "./add-comment-to-issue.tool.js";
import { createLabelTool } from "./create-label.tool.js";

// Acá se van a registrar las tools
export function registerTools(server: McpServer): void {
    server.registerTool(
        listRepositoriesTool.name,
        {
            description: listRepositoriesTool.description,
            inputSchema: listRepositoriesTool.schema
        },
        listRepositoriesTool.handler,
    );

    server.registerTool(
        createIssueTool.name,
        {
            description: createIssueTool.description,
            inputSchema: createIssueTool.schema,
        },
        createIssueTool.handler,
    );

    server.registerTool(
        createRepoTool.name,
        {
            description: createRepoTool.description,
            inputSchema: createRepoTool.schema,
        },
        createRepoTool.handler,
    );

    server.registerTool(
        createFileTool.name,
        {
            description: createFileTool.description,
            inputSchema: createFileTool.schema
        },
        createFileTool.handler,
    );

    server.registerTool(
        getFileContentTool.name,
        {
            description: getFileContentTool.description,
            inputSchema: getFileContentTool.schema,
        },
        getFileContentTool.handler,
    );

    server.registerTool(
        listIssuesTool.name,
        {
            description: listIssuesTool.description,
            inputSchema: listIssuesTool.schema,
        },
        listIssuesTool.handler,
    );

    server.registerTool(
        closeIssueTool.name,
        {
            description: closeIssueTool.description,
            inputSchema: closeIssueTool.schema,
        },
        closeIssueTool.handler,
    );

    server.registerTool(
        addCommentToIssueTool.name,
        {
            description: addCommentToIssueTool.description,
            inputSchema: addCommentToIssueTool.schema,
        },
        addCommentToIssueTool.handler,
    );

    server.registerTool(
        createLabelTool.name,
        {
            description: createLabelTool.description,
            inputSchema: createLabelTool.schema,
        },
        createLabelTool.handler,
    );
}
