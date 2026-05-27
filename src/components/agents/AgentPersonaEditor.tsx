"use client";

import { useState } from "react";
import { Bot, CheckCircle2, ChevronDown, ChevronUp, Save, SendHorizontal, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { WarmCard } from "@/components/layout/WarmCard";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/form-controls";
import type { Agent, AgentPersona } from "@/types/domain";

type PersonaField = {
  key: keyof AgentPersona;
  label: string;
  rows: number;
  maxLength: number;
};

type PersonaResponse = {
  agent?: Agent;
  persona?: AgentPersona;
  publishStatus?: "anthropic_updated" | "local_only" | "anthropic_skipped";
  skippedReason?: string | null;
  anthropicAgentVersion?: number | null;
  error?: string;
};

const fields: PersonaField[] = [
  { key: "role", label: "역할", rows: 4, maxLength: 2000 },
  { key: "tone", label: "말투", rows: 2, maxLength: 800 },
  { key: "outputStyle", label: "응답 형식", rows: 3, maxLength: 1200 },
  { key: "priorities", label: "우선순위", rows: 3, maxLength: 1600 },
  { key: "boundaries", label: "경계/금지", rows: 3, maxLength: 1600 },
  { key: "customInstructions", label: "추가 지시", rows: 3, maxLength: 2500 },
  { key: "guestPrompt", label: "회의방 게스트", rows: 3, maxLength: 1200 },
];

export function AgentPersonaEditor({
  roomId,
  agent,
  canEdit,
}: {
  roomId: string;
  agent: Agent;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [persona, setPersona] = useState<AgentPersona>(() => initialPersona(agent));
  const [draftUpdatedAt, setDraftUpdatedAt] = useState(agent.personaDraftUpdatedAt ?? null);
  const [publishedAt, setPublishedAt] = useState(agent.personaPublishedAt ?? null);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isBusy = Boolean(busy);
  const panelId = `${agent.id}-persona-editor`;

  function updatePersonaField(key: keyof AgentPersona, value: string) {
    setPersona((current) => ({ ...current, [key]: value }));
    setNotice(null);
    setError(null);
  }

  async function saveDraft() {
    if (!canEdit || isBusy) {
      return;
    }
    setBusy("save");
    setNotice(null);
    setError(null);
    try {
      const payload = await sendPersonaRequest(`/api/rooms/${roomId}/agent-persona`, "PATCH", persona);
      const nextPersona = payload.persona ?? persona;
      setPersona(nextPersona);
      setDraftUpdatedAt(payload.agent?.personaDraftUpdatedAt ?? new Date().toISOString());
      setNotice("초안을 저장했습니다.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "초안을 저장하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function publishPersona() {
    if (!canEdit || isBusy) {
      return;
    }
    setBusy("publish");
    setNotice(null);
    setError(null);
    try {
      const payload = await sendPersonaRequest(`/api/rooms/${roomId}/agent-persona/publish`, "POST", persona);
      const nextPersona = payload.persona ?? persona;
      setPersona(nextPersona);
      setDraftUpdatedAt(payload.agent?.personaDraftUpdatedAt ?? new Date().toISOString());
      setPublishedAt(payload.agent?.personaPublishedAt ?? new Date().toISOString());
      setNotice(publishNotice(payload));
      router.refresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "페르소나를 발행하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <WarmCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-balance">
            <Bot className="size-4 text-sage" />
            {agent.name} 페르소나 편집
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit ? (
            <span className="hidden rounded-md border border-line bg-white/45 px-2 py-1 text-xs text-ink-soft sm:inline-flex">
              편집 가능
            </span>
          ) : (
            <span className="hidden items-center gap-1 rounded-md border border-line bg-white/45 px-2 py-1 text-xs text-ink-soft sm:inline-flex">
              <ShieldAlert className="size-3" />
              읽기 전용
            </span>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {isOpen ? "접기" : "펼치기"}
          </Button>
        </div>
      </div>

      {isOpen ? (
        <div id={panelId}>
          <div className="mt-4 space-y-3">
            {fields.map((field) => (
              <label key={field.key} className="block text-sm font-medium">
                {field.label}
                <TextArea
                  value={persona[field.key]}
                  onChange={(event) => updatePersonaField(field.key, event.target.value)}
                  rows={field.rows}
                  maxLength={field.maxLength}
                  disabled={!canEdit || isBusy}
                  className="mt-1 min-h-0 disabled:bg-paper/60"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={saveDraft} disabled={!canEdit || isBusy}>
              <Save className="size-4" />
              {busy === "save" ? "저장 중" : "초안 저장"}
            </Button>
            <Button type="button" size="sm" onClick={publishPersona} disabled={!canEdit || isBusy}>
              <SendHorizontal className="size-4" />
              {busy === "publish" ? "발행 중" : "발행"}
            </Button>
          </div>

          <div className="mt-3 space-y-1 text-xs text-ink-soft">
            {draftUpdatedAt ? <p>초안 {formatDateTime(draftUpdatedAt)}</p> : null}
            {publishedAt ? <p>발행 {formatDateTime(publishedAt)}</p> : null}
            {notice ? (
              <p className="flex items-center gap-1 text-sage">
                <CheckCircle2 className="size-3" />
                {notice}
              </p>
            ) : null}
            {error ? <p className="text-terracotta">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </WarmCard>
  );
}

function initialPersona(agent: Agent): AgentPersona {
  return {
    role: agent.personaDraft?.role ?? agent.personaPublished?.role ?? agent.systemPrompt,
    tone: agent.personaDraft?.tone ?? agent.personaPublished?.tone ?? "신중하고 간결한 한국어로 답한다.",
    outputStyle:
      agent.personaDraft?.outputStyle ??
      agent.personaPublished?.outputStyle ??
      "먼저 결론을 짧게 말하고, 필요한 다음 행동을 bullet로 정리한다.",
    priorities:
      agent.personaDraft?.priorities ??
      agent.personaPublished?.priorities ??
      `${agent.role || agent.name}의 업무 목표, 일정, 산출물 품질을 우선한다.`,
    boundaries:
      agent.personaDraft?.boundaries ??
      agent.personaPublished?.boundaries ??
      "학생 개인정보, 계정, API 키, 내부 민감정보를 출력하지 않는다.",
    customInstructions: agent.personaDraft?.customInstructions ?? agent.personaPublished?.customInstructions ?? "",
    guestPrompt:
      agent.personaDraft?.guestPrompt ??
      agent.personaPublished?.guestPrompt ??
      agent.guestPrompt ??
      "회의방에서는 5문장 이내로 출처와 다음 행동을 포함해 브리핑한다.",
  };
}

async function sendPersonaRequest(url: string, method: "PATCH" | "POST", persona: AgentPersona) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  const payload = (await response.json()) as PersonaResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "페르소나 요청을 처리하지 못했습니다.");
  }
  return payload;
}

function publishNotice(payload: PersonaResponse) {
  if (payload.publishStatus === "anthropic_updated") {
    return payload.anthropicAgentVersion
      ? `Claude Managed Agent v${payload.anthropicAgentVersion}에 발행했습니다.`
      : "Claude Managed Agent에 발행했습니다.";
  }
  if (payload.publishStatus === "local_only") {
    return "앱 페르소나로 발행했습니다.";
  }
  if (payload.publishStatus === "anthropic_skipped") {
    return "앱 페르소나로 발행했습니다.";
  }
  return "페르소나를 발행했습니다.";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
