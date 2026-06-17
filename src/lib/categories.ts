export type Category = "nail_art" | "barefoot" | "aesthetic" | "other";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "nail_art", label: "Nail art" },
  { value: "barefoot", label: "Barefoot" },
  { value: "aesthetic", label: "Aesthetic" },
  { value: "other", label: "Other" },
];

export function categoryLabel(c: string): string {
  return CATEGORIES.find((x) => x.value === c)?.label ?? c;
}
