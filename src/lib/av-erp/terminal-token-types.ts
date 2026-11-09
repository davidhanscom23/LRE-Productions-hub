export type AvTokenScope = "read" | "write";

export type AvIntegrationTokenRow = {
  id: string;
  label: string;
  kind: "api" | "calendar";
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by?: string | null;
};
