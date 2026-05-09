import { WarmCard } from "@/components/layout/WarmCard";

export function MeetingSummaryReview() {
  return (
    <WarmCard>
      <p className="text-sm font-semibold">AI 회의록 검토</p>
      <p className="mt-2 text-sm text-pretty text-ink-soft">
        회의 요약은 자동 반영하지 않고 사람이 확인한 뒤 결정사항, 할 일, 공유/반입 흐름으로 넘깁니다.
      </p>
    </WarmCard>
  );
}
