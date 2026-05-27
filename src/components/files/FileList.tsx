import { FileText } from "lucide-react";
import { FileDeleteButton } from "@/components/files/FileDeleteButton";
import { FileDownloadButton } from "@/components/files/FileDownloadButton";
import { FileShareToMeetingButton } from "@/components/files/FileShareToMeetingButton";
import { FileUploadForm } from "@/components/files/FileUploadForm";
import { WarmCard } from "@/components/layout/WarmCard";
import type { FileRecord } from "@/types/domain";

export function FileList({ files, roomId }: { files: FileRecord[]; roomId: string }) {
  return (
    <WarmCard>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">파일</p>
        <span className="text-xs text-ink-soft tabular-nums">{files.length}</span>
      </div>
      <div className="space-y-2">
        {files.length ? (
          files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 rounded-md border border-line bg-white/35 p-2">
              <FileText className="size-4 text-bronze" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.originalName}</p>
                <p className="text-xs text-ink-soft tabular-nums">v{file.versionNo} · {Math.round(file.sizeBytes / 1024)}KB · {file.accessLevel}</p>
              </div>
              {roomId !== "meeting" ? (
                <FileShareToMeetingButton fileId={file.id} roomId={roomId} fileName={file.originalName} />
              ) : null}
              <FileDownloadButton fileId={file.id} roomId={roomId} />
              {file.accessLevel !== "read" ? <FileDeleteButton fileId={file.id} roomId={roomId} fileName={file.originalName} /> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-soft">아직 파일이 없습니다.</p>
        )}
      </div>
      <div className="mt-3">
        <FileUploadForm roomId={roomId} />
      </div>
    </WarmCard>
  );
}
