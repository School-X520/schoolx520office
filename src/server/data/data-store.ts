import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

type Awaitable<T> = T | Promise<T>;

// 함수의 Promise 반환을 sync/async 양쪽 모두 허용하도록 넓힌다(mockStore는 sync, supabaseStore는 async).
type AsAwaitable<F> = F extends (...args: infer A) => infer R
  ? (...args: A) => R extends Promise<infer U> ? Awaitable<U> : Awaitable<R>
  : F;

// 두 스토어의 저장 모델이 본질적으로 달라 입력 계약을 통일하기 어려운 메서드는 강제 대상에서 제외한다.
// 이 메서드들은 호출부가 이미 `shouldUseMockData() ? mockStore : supabaseStore`로 분기해 스토어별 인자를 넘긴다.
// - addFile: mock은 storagePath의 room prefix로, supabaseStore는 file_room_access 조인 + roomId로 방을 표현한다.
type DivergentMethods = "addFile";

// 프로덕션 스토어(supabaseStore)를 진실원으로 한 데이터 접근 계약.
// getDataStore()의 반환 타입으로 사용되며, 두 스토어가 이 타입에 모두 assignable해야 하므로
// mockStore가 supabaseStore의 메서드 표면을 (sync 또는 async로) 빠짐없이 구현하도록 컴파일 타임에 강제한다.
// 한쪽에만 메서드를 추가하거나 시그니처를 바꾸면 여기서 컴파일이 실패해 런타임 "is not a function" 드리프트를 막는다.
export type DataStore = {
  [K in Exclude<keyof typeof supabaseStore, DivergentMethods>]: AsAwaitable<(typeof supabaseStore)[K]>;
};

// 데이터 소스 선택을 단일 지점으로 일원화한다(기존엔 `shouldUseMockData() ? mockStore : supabaseStore` 삼항이 산재).
export function getDataStore(): DataStore {
  return shouldUseMockData() ? mockStore : supabaseStore;
}
