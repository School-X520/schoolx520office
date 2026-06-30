import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VideoMeetingArtifact } from "@/types/domain";

export function VideoMeetingArtifactCard({ artifact }: { artifact: VideoMeetingArtifact }) {
  return (
    <article className="rounded-md border border-line bg-white/45 p-3">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-4 text-bronze" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold">{artifact.title}</p>
          <p className="text-xs text-ink-soft">{artifact.artifactType} · {artifact.status}</p>
          {artifact.content ? <p className="mt-2 line-clamp-3 text-sm text-pretty text-ink-soft">{artifact.content}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled>
              결정사항 만들기
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled>
              할 일 만들기
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled>
              작업방으로 가져가기
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
