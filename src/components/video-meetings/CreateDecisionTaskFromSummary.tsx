import { Button } from "@/components/ui/button";

export function CreateDecisionTaskFromSummary() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary">결정사항 반영</Button>
      <Button size="sm" variant="secondary">할 일 반영</Button>
      <Button size="sm" variant="secondary">업무방으로 가져가기</Button>
    </div>
  );
}
