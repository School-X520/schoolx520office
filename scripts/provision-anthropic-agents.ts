import { createClient } from "@supabase/supabase-js";
import { agentConfig } from "../config/agents";
import { AnthropicManagedAgentsApi, type ManagedAgent } from "../src/lib/anthropic/managed-agents-api";
import { getManagedAgentToolConfigs } from "../src/server/agents/tools/tool-registry";

type DbAgent = {
  id: string;
  room_id: string | null;
  anthropic_agent_id: string | null;
  anthropic_environment_id: string | null;
  metadata: Record<string, unknown> | null;
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const skipDb = args.has("--skip-db");
const environmentIdArg = readArgValue("--environment-id") ?? process.env.ANTHROPIC_ENVIRONMENT_ID;
const appId = process.env.ANTHROPIC_PROVISION_APP_ID ?? "schoolx520office";
const environmentName = process.env.ANTHROPIC_ENVIRONMENT_NAME ?? `${appId}-shared-production`;

async function main() {
  printPlan();

  if (dryRun) {
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 필요합니다. Anthropic Console에서 API key를 만든 뒤 환경변수로 넣어 주세요.");
  }

  const supabase = skipDb ? null : createSupabaseClient();
  const dbAgents = supabase ? await fetchDbAgents(supabase) : [];
  const anthropic = new AnthropicManagedAgentsApi({
    apiKey,
    betaHeader: process.env.ANTHROPIC_BETA_HEADER,
    baseUrl: process.env.ANTHROPIC_API_BASE_URL,
  });

  const environmentId = await resolveEnvironmentId(anthropic, dbAgents);
  const remoteAgents = await anthropic.listAgents().catch(() => []);

  for (const config of agentConfig) {
    const dbAgent = dbAgents.find((agent) => agent.id === config.id);
    const existingRemote = findRemoteAgent(remoteAgents, config.id, dbAgent?.anthropic_agent_id);
    const remoteAgent =
      existingRemote && !force
        ? await anthropic.updateAgent({
            agentId: existingRemote.id,
            version: existingRemote.version ?? 1,
            name: `SchoolX ${config.name}`,
            model: config.defaultModel,
            system: buildSystemPrompt(config),
            description: `${config.name} for ${config.roomId} room in SchoolX AI Office.`,
            tools: getManagedAgentToolConfigs(),
            metadata: {
              app: appId,
              schoolx_agent_id: config.id,
              schoolx_room_id: config.roomId,
            },
          })
        : await anthropic.createAgent({
            name: `SchoolX ${config.name}`,
            model: config.defaultModel,
            system: buildSystemPrompt(config),
            description: `${config.name} for ${config.roomId} room in SchoolX AI Office.`,
            tools: getManagedAgentToolConfigs(),
            metadata: {
              app: appId,
              schoolx_agent_id: config.id,
              schoolx_room_id: config.roomId,
            },
          });

    console.log(`[agent] ${config.id} -> ${remoteAgent.id} (v${remoteAgent.version ?? "?"})`);

    if (supabase) {
      await saveProvisioningIds(supabase, config.id, remoteAgent, environmentId, dbAgent?.metadata ?? {});
    } else {
      printSql(config.id, remoteAgent.id, environmentId);
    }
  }

  console.log("\nDone. 다음 단계: ENABLE_REAL_AGENTS=true 로 바꾸고 배포하세요.");
}

function printPlan() {
  console.log(`${dryRun ? "[dry-run]" : "[provision]"} Claude Managed Agents`);
  console.log(`- app: ${appId}`);
  console.log(`- environment: ${environmentIdArg ?? environmentName}`);
  console.log(`- room agents: ${agentConfig.length}`);
  console.log("- meeting room: resident bot 없음, 업무방 봇을 게스트로 호출");
  console.log(`- db update: ${skipDb ? "skip" : "Supabase agents table"}`);
  console.log("");

  for (const agent of agentConfig) {
    console.log(`  ${agent.id.padEnd(23)} ${agent.name} (${agent.roomId})`);
  }
  console.log("");
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다. DB 저장 없이 보려면 --skip-db를 쓰세요.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchDbAgents(supabase: ReturnType<typeof createSupabaseClient>) {
  const { data, error } = await supabase
    .from("agents")
    .select("id, room_id, anthropic_agent_id, anthropic_environment_id, metadata")
    .order("room_id");

  if (error) {
    throw error;
  }

  return (data ?? []) as DbAgent[];
}

async function resolveEnvironmentId(anthropic: AnthropicManagedAgentsApi, dbAgents: DbAgent[]) {
  if (environmentIdArg) {
    console.log(`[env] using explicit ${environmentIdArg}`);
    return environmentIdArg;
  }

  const linkedEnvironment = dbAgents.find((agent) => agent.anthropic_environment_id)?.anthropic_environment_id;
  if (linkedEnvironment) {
    console.log(`[env] reusing DB environment ${linkedEnvironment}`);
    return linkedEnvironment;
  }

  const environments = await anthropic.listEnvironments().catch(() => []);
  const existing = environments.find((environment) => environment.metadata?.app === appId);
  if (existing) {
    console.log(`[env] reusing remote environment ${existing.id}`);
    return existing.id;
  }

  const created = await anthropic.createEnvironment({
    name: environmentName,
    description: "Shared limited-network cloud environment for SchoolX room bots.",
    metadata: { app: appId, scope: "schoolx-room-bots" },
  });
  console.log(`[env] created ${created.id}`);
  return created.id;
}

function findRemoteAgent(remoteAgents: ManagedAgent[], schoolxAgentId: string, linkedAgentId?: string | null) {
  return (
    remoteAgents.find((agent) => linkedAgentId && agent.id === linkedAgentId) ??
    remoteAgents.find((agent) => agent.metadata?.app === appId && agent.metadata.schoolx_agent_id === schoolxAgentId)
  );
}

function buildSystemPrompt(config: (typeof agentConfig)[number]) {
  return [
    config.systemPrompt,
    "",
    "공통 운영 원칙:",
    "- 교과연구회 AI Office의 업무방 봇으로 행동한다.",
    "- 학생 개인정보, 계정, API 키, 내부 민감정보를 출력하지 않는다.",
    "- 앱이 전달한 방 요약, 최근 메시지, 사용자 요청을 우선 근거로 삼는다.",
    "- 모르는 내용은 추측하지 말고 확인 질문으로 남긴다.",
    "- 결정사항, 할 일, 공유 필요 항목은 짧고 실행 가능하게 정리한다.",
    "- 방 요약/메시지 검색/파일 목록/회의방 공유/업무방 반입/할 일 생성/장기 기억 제안은 제공된 SchoolX custom tools를 우선 사용한다.",
    "- 에이전트는 Supabase DB에 직접 접근하지 않고 SchoolX custom tool 결과만 신뢰한다.",
    "- 사용자가 파일, 문서, 표, 다운로드 가능한 산출물을 요청하면 텍스트로만 답하지 말고 컨테이너에 실제 파일을 생성하고 파일명과 경로를 답변에 포함한다.",
    "",
    "메인 회의방 게스트 호출 원칙:",
    config.guestPrompt,
  ].join("\n");
}

async function saveProvisioningIds(
  supabase: ReturnType<typeof createSupabaseClient>,
  agentId: string,
  remoteAgent: ManagedAgent,
  environmentId: string,
  existingMetadata: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("agents")
    .update({
      anthropic_agent_id: remoteAgent.id,
      anthropic_environment_id: environmentId,
      metadata: {
        ...existingMetadata,
        anthropic_agent_version: remoteAgent.version ?? null,
        anthropic_provisioned_at: new Date().toISOString(),
      },
    })
    .eq("id", agentId);

  if (error) {
    throw error;
  }
}

function printSql(agentId: string, anthropicAgentId: string, environmentId: string) {
  console.log(
    `update public.agents set anthropic_agent_id = '${anthropicAgentId}', anthropic_environment_id = '${environmentId}' where id = '${agentId}';`,
  );
}

function readArgValue(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
