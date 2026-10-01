// The shop's fixed "buy X get X free" coffee combo deals (prices in KIP).
export const COMBO_PRESETS = [
  { label: '1 แถม 1', paid: 1, free: 1, total: 280000 },
  { label: '2 แถม 2', paid: 2, free: 2, total: 550000 },
  { label: '3 แถม 3', paid: 3, free: 3, total: 800000 },
  { label: '5 แถม 5', paid: 5, free: 5, total: 1200000 },
  { label: '10 แถม 10', paid: 10, free: 10, total: 2200000 },
] as const
