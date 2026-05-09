import { agentConfig } from "../config/agents";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY is empty. Provisioning is skipped.");
    process.exitCode = 0;
    return;
  }

  for (const agent of agentConfig) {
    console.log(`${dryRun ? "[dry-run]" : "[setup-required]"} ${agent.id} (${agent.roomId})`);
  }

  if (!dryRun) {
    console.log("Managed Agents API creation is intentionally isolated behind docs/ANTHROPIC_SETUP.md.");
  }
}

void main();
