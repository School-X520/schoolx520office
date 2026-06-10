import { describe, expect, it } from "vitest";

import { getDataStore } from "@/server/data/data-store";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

// data-store.ts의 DataStore 타입이 컴파일 타임에 두 스토어의 메서드 표면 정합성을 강제하지만,
// 런타임에서도 mockStore가 supabaseStore의 모든 메서드를 실제로 구현하는지 한 번 더 확인한다.
// (의도적으로 분기되는 addFile은 DataStore에서 제외되어 있으므로 예외 처리.)
const INTENTIONALLY_DIVERGENT = new Set(["addFile"]);

describe("DataStore 정합성", () => {
  it("mockStore가 supabaseStore의 모든 메서드를 구현한다", () => {
    const supabaseMethods = Object.keys(supabaseStore).filter(
      (key) => typeof (supabaseStore as Record<string, unknown>)[key] === "function",
    );
    const missing = supabaseMethods.filter(
      (key) =>
        !INTENTIONALLY_DIVERGENT.has(key) &&
        typeof (mockStore as Record<string, unknown>)[key] !== "function",
    );
    expect(missing).toEqual([]);
  });

  it("getDataStore()는 단건 조회 같은 핵심 메서드를 노출한다", () => {
    const store = getDataStore();
    expect(typeof store.getAgentRunById).toBe("function");
    expect(typeof store.listActiveAgentRunsForRoom).toBe("function");
    expect(typeof store.getIntegrationToken).toBe("function");
  });
});
