import type { Octokit } from "@octokit/rest";
import { commiFiles } from "./commit-files.js";

export async function listRepositories(
    octokit: Octokit,
    params: {
        type?: "all" | "owner" | "public" | "private" | "member";
        per_page?: number;
    },
) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser(params);
    return data;
}

export async function createRepository(
    octokit: Octokit,
    params: {
        name: string;
        description?: string;
        private?: boolean;
        auto_init?: boolean;
    },
) {
    const { data } = await octokit.rest.repos.createForAuthenticatedUser(params);
    return data;
}

export async function createIssue(
    octokit: Octokit,
    params: {
        owner: string;
        repo: string;
        title: string;
        body?: string;
    },
) {
    const { data } = await octokit.rest.issues.create(params);
    return data;
}

export async function listIssues(
    octokit: Octokit,
    params: {
        owner: string;
        repo: string;
        per_page?: number;
    },
) {
    const { data } = await octokit.rest.issues.listForRepo({
        ...params,
        state: "open",
    });
    return data;
}

export async function closeIssue(
    octokit: Octokit,
    params: {
        owner: string;
        repo: string;
        issue_number: number;
    },
) {
    const { data } = await octokit.rest.issues.update({
        ...params,
        state: "closed",
    });
    return data;
}

export async function addCommentToIssue(
    octokit: Octokit,
    params: {
        owner: string;
        repo: string;
        issue_number: number;
        body: string;
    },
) {
    const { data } = await octokit.rest.issues.createComment(params);
    return data;
}

export async function createLabel(
    octokit: Octokit,
    params: {
        owner: string;
        repo: string;
        name: string;
        color?: string;
        description?: string;
    },
) {
    const { data } = await octokit.rest.issues.createLabel(params);
    return data;
}

export async function getFileContent(
    octokit: Octokit,
    params: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
    },
) {
    const { data } = await octokit.rest.repos.getContent(params);
    return data;
}

export async function createFile(
    octokit: Octokit,
    params: {
        owner: string;
        repo: string;
        path: string;
        content: string;
        message: string;
        branch?: string;
    },
) {
    return commiFiles(octokit, {
        owner: params.owner,
        repo: params.repo,
        files: [{ path: params.path, content: params.content }],
        message: params.message,
        branch: params.branch ?? "main",
    });
}
