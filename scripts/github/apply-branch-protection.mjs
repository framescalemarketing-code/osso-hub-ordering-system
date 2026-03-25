import { execFileSync } from "node:child_process";

const ownerRepo = process.env.GITHUB_REPOSITORY ?? getRepoFromGit();
const [owner, repo] = ownerRepo.split("/");

if (!owner || !repo) {
  throw new Error(
    "Could not resolve owner/repo. Set GITHUB_REPOSITORY=owner/repo or run inside a git clone with an origin remote."
  );
}

const branches = ["main", "develop"];
for (const branch of branches) {
  ensureBranchExists(branch);
  applyProtection(branch);
}

console.log(`Branch protections applied for ${branches.join(", ")} on ${owner}/${repo}`);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  }).trim();
}

function getRepoFromGit() {
  const remote = run("git", ["remote", "get-url", "origin"]);
  const httpsMatch = remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
  if (!httpsMatch) return "";
  return `${httpsMatch[1]}/${httpsMatch[2]}`;
}

function ensureBranchExists(branch) {
  try {
    run("gh", ["api", `repos/${owner}/${repo}/branches/${branch}`]);
  } catch {
    throw new Error(
      `Branch "${branch}" was not found on ${owner}/${repo}. Create and push it before applying protections.`
    );
  }
}

function applyProtection(branch) {
  const payload = {
    required_status_checks: {
      strict: true,
      contexts: ["validate", "CodeQL"],
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: true,
      required_approving_review_count: 1,
      require_last_push_approval: true,
    },
    restrictions: null,
    required_linear_history: true,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: true,
  };

  run(
    "gh",
    [
      "api",
      "--method",
      "PUT",
      `repos/${owner}/${repo}/branches/${branch}/protection`,
      "--input",
      "-",
    ],
    { input: JSON.stringify(payload) }
  );
}
