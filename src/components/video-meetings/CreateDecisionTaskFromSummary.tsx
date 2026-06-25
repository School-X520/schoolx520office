import { Button } from "@/components/ui/button";

export function CreateDecisionTaskFromSummary() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" disabled>
        결정사항 반영
      </Button>
      <Button type="button" size="sm" variant="secondary" disabled>
        할 일 반영
      </Button>
      <Button type="button" size="sm" variant="secondary" disabled>
        업무방으로 가져가기
      </Button>
    </div>
  );
}
