import { Octokit } from "@octokit/rest";
import { FileToCommit } from "../utils/types.js";

interface CommitFilesParams {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    files: FileToCommit[];
}

async function commiFiles(
    octokit: Octokit,
    { owner, repo, branch, message, files }: CommitFilesParams,
) {
    if (files.length === 0) {
        throw new Error("commitFiles: hace falta al menos un archivo.");
    }

    //GETREF
    const { data: ref } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
    });

    const parentSha = ref.object.sha;

    //GETCOMMIT
    const { data: parentCommit } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: parentSha,
    })

    //CREATEBLOB
    const blobs = []
    for (const file of files) {
        const { data: blob } = await octokit.rest.git.createBlob({
            owner,
            repo,
            content: file.content,
            encoding: "utf-8",
        });
        blobs.push({ path: file.path, sha: blob.sha });
    }

    //CREATETREE
    const { data: tree } = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: parentCommit.tree.sha,
        tree: blobs.map((blob) => ({
            path: blob.path,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blob.sha,
        })),
    });

    //CREATECOMMIT
    const { data: commit } = await octokit.rest.git.createCommit({
        owner,
        repo,
        message,
        tree: tree.sha,
        parents: [parentSha],
    });

    //UPDATEREF
    await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: commit.sha
    });

    return {
        commit: commit.sha,
        url: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
        branch,
        paths: blobs.map((blob) => blob.path),
    };
}

export { commiFiles };