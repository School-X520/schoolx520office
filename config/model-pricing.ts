export type ModelPrice = {
  model: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  notes: string;
};

export const modelPricing: ModelPrice[] = [
  {
    model: "claude-sonnet-4-5",
    inputPerMillionUsd: 0,
    outputPerMillionUsd: 0,
    notes: "가격은 변동 가능하므로 운영 전 최신 Anthropic 가격표로 채우세요.",
  },
];
