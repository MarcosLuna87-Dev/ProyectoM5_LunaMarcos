import { z } from "zod";
import { owner, repo, issue_number } from "./index.js";

export const closeIssueSchema = {
    owner,
    repo,
    issue_number,
};

export const closeIssueInputSchema = z.object(closeIssueSchema);

export type CloseIssueInput = z.infer<typeof closeIssueInputSchema>;
