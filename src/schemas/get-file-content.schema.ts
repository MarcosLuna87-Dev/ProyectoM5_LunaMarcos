import { z } from "zod";
import { owner, repo, path, branch } from "./index.js";

export const getFileContentSchema = {
    owner,
    repo,
    path,
    branch,
};

export const getFileContentInputSchema = z.object(getFileContentSchema);

export type GetFileContentInput = z.infer<
    typeof getFileContentInputSchema
>;