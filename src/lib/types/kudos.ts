export type KudoValue = "" | "integrity" | "gratitude" | "teamwork";

export type Kudo = {
  id: string;
  from_user: string;
  to_user: string;
  message: string;
  value: KudoValue;
  created_at: string;
  from_name?: string;
  to_name?: string;
};

export const KUDO_VALUES: { value: Exclude<KudoValue, "">; label: string }[] = [
  { value: "integrity", label: "Integrity" },
  { value: "gratitude", label: "Gratitude" },
  { value: "teamwork", label: "Teamwork" },
];

export function kudoValueLabel(v: KudoValue): string {
  return KUDO_VALUES.find((x) => x.value === v)?.label ?? "";
}
