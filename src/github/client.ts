import "dotenv/config";
import { Octokit } from "@octokit/rest";
import { withRetry } from "../utils/retry.js";

export function createOctokit(): Octokit {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        throw new Error(
            "Falta GITHUB_TOKEN. Revisa tus variables de entorno y agregalo."
        );
    };

    const octokit = new Octokit({
        auth: token,
        userAgent: "github-mcp",
    })
    octokit.hook.wrap("request", async (request, options) => {
        return withRetry(async () => await request(options));
    });
    return octokit;
}