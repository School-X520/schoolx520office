import { FileText } from "lucide-react";
import { WarmCard } from "@/components/layout/WarmCard";
import type { FileRecord } from "@/types/domain";

export function FileList({ files }: { files: FileRecord[] }) {
  return (
    <WarmCard>
      <p className="mb-3 text-sm font-semibold">파일</p>
      <div className="space-y-2">
        {files.length ? (
          files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 rounded-md border border-line bg-white/35 p-2">
              <FileText className="size-4 text-bronze" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.originalName}</p>
                <p className="text-xs text-ink-soft tabular-nums">v{file.versionNo} · {Math.round(file.sizeBytes / 1024)}KB · {file.accessLevel}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-soft">아직 파일이 없습니다.</p>
        )}
      </div>
    </WarmCard>
  );
}
