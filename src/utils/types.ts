// Dto acotado: No devolvemos el payload crudo de GitHub, lo moldeamos con estos DTOs
export interface ListRepoDto {
    name: string;
    fullName: string;
    url: string;
    private: boolean;
    stars: number;
    language: string | null;
}

export interface IssueDto {
    number: number;
    title: string;
    url: string;
    state: string;
}

export interface CreateRepoDto {
    name: string;
    fullName: string;
    url: string;
    description: string | null;
    private: boolean;
}

export interface FileToCommit {
    path: string;
    content: string;
}

export interface CommitFilesResults {
    commitSha: string;
    url: string;
    branch: string;
    paths: string[];
}

export interface FileContentDto {
    path: string;
    content: string;
    sha: string;
}

export interface IssueCommentDto {
    id: number;
    url: string;
    body: string;
}

export interface LabelDto {
    id: number;
    name: string;
    color: string;
    description: string | null;
}
