import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isValidSlug } from "../slug";
import { CRM_PARTIAL_KEY } from "./lifecycle-core";
import {
  FORM_STATUS_VALUES,
  isCalendarDate,
  LOG_STATUS_VALUES,
  MIGRATION_FILE_PATTERN,
  RPC,
  RPC_SIGNATURES,
  SCORE_LABEL_VALUES,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_SQL_PATTERN,
  SUBMISSION_STAGE_VALUES,
  TABLES,
  toDbInt,
} from "./schema-core";

// vitest runs from the repo root (vitest.config.mts); jsdom rewrites import.meta.url.
const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");
const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
const inquiryMigrations = migrationFiles.filter((f) => MIGRATION_FILE_PATTERN.test(f));
const migrationName = inquiryMigrations.length === 1 ? inquiryMigrations[0] : "";
const sql = migrationName ? readFileSync(join(MIGRATIONS_DIR, migrationName), "utf8") : "";

/**
 * Y? keeps What's New in a changelog_entries table, so its entry goes inside this migration; a hub
 * without that table (LRE: src/lib/changelog.ts) must not insert into it, or the run fails.
 */
const hubHasChangelogTable = migrationFiles.some(
  (f) =>
    f !== migrationName &&
    /create table if not exists public\.changelog_entries\b/i.test(readFileSync(join(MIGRATIONS_DIR, f), "utf8")),
);

/**
 * SQL with line comments removed, so prose in comments never matches a rule. Split on \r?\n: a
 * Windows checkout (core.autocrlf) ends each line with \r, which `.` never matches, so a plain
 * "\n" split would leave every comment in place.
 */
const code = sql
  .split(/\r?\n/)
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

function checkValues(constraintName: string): string[] {
  const at = code.indexOf(`constraint ${constraintName} check`);
  expect(at, `constraint ${constraintName} exists`).toBeGreaterThan(-1);
  const tail = code.slice(at);
  const inList = /\bin\s*\(([^)]*)\)/.exec(tail);
  expect(inList, `constraint ${constraintName} has an in (...) list`).not.toBeNull();
  return (inList?.[1] ?? "")
    .split(",")
    .map((v) => v.trim().replace(/^'/, "").replace(/'$/, ""))
    .filter(Boolean);
}

describe("the inquiry forms migration file", () => {
  it("is the one supabase/migrations/<number>_inquiry_forms.sql", () => {
    expect(inquiryMigrations).toHaveLength(1);
    expect(sql.length).toBeGreaterThan(0);
  });
});

describe("migration check constraints accept exactly what the server writes", () => {
  it("form status", () => {
    expect(checkValues("inquiry_forms_status_check")).toEqual([...FORM_STATUS_VALUES]);
  });

  it("submission stage", () => {
    expect(checkValues("inquiry_submissions_stage_check")).toEqual([...SUBMISSION_STAGE_VALUES]);
  });

  it("score label", () => {
    expect(checkValues("inquiry_submissions_score_label_check")).toEqual([...SCORE_LABEL_VALUES]);
  });

  it("log status", () => {
    expect(checkValues("inquiry_log_status_check")).toEqual([...LOG_STATUS_VALUES]);
  });

  it("score range is 0..100 (computeScore clamps to the same range)", () => {
    expect(code).toMatch(/score is null or score between 0 and 100/);
  });

  it("slug check uses the same pattern and length bounds as isValidSlug", () => {
    expect(code).toContain(`slug ~ '${SLUG_SQL_PATTERN}'`);
    expect(code).toContain(`char_length(slug) between ${SLUG_MIN_LENGTH} and ${SLUG_MAX_LENGTH}`);
    const sqlRule = (s: string) =>
      s.length >= SLUG_MIN_LENGTH && s.length <= SLUG_MAX_LENGTH && new RegExp(SLUG_SQL_PATTERN).test(s);
    const samples = [
      "check-your-date",
      "book-partner-brand",
      "abc",
      "ab",
      "a".repeat(60),
      "a".repeat(61),
      "Check-Your-Date",
      "check--date",
      "-check",
      "check-",
      "check_date",
      "2027-weddings",
      "",
    ];
    for (const s of samples) {
      expect(isValidSlug(s), `isValidSlug("${s}") agrees with the SQL check`).toBe(sqlRule(s));
    }
  });
});

describe("the migration is idempotent (safe to run twice)", () => {
  it("creates every table with if not exists", () => {
    const creates = code.match(/create table[^(]*/gi) ?? [];
    expect(creates.length).toBe(Object.keys(TABLES).length);
    for (const c of creates) expect(c.toLowerCase()).toContain("if not exists");
    for (const table of Object.values(TABLES)) {
      expect(code).toContain(`create table if not exists public.${table} (`);
    }
  });

  it("creates every index with if not exists", () => {
    const creates = code.match(/create (unique )?index[^\n]*/gi) ?? [];
    expect(creates.length).toBeGreaterThan(0);
    for (const c of creates) expect(c.toLowerCase()).toContain("if not exists");
  });

  it("drops every policy before creating it", () => {
    const re = /create policy "([^"]+)" on (public\.\w+)/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = re.exec(code))) {
      count += 1;
      expect(code).toContain(`drop policy if exists "${m[1]}" on ${m[2]};`);
    }
    expect(count).toBeGreaterThan(0);
  });

  it("drops every trigger before creating it", () => {
    const re = /create trigger (\w+)\s+before update on (public\.\w+)/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = re.exec(code))) {
      count += 1;
      expect(code).toContain(`drop trigger if exists ${m[1]} on ${m[2]};`);
    }
    expect(count).toBe(3);
  });

  it("only uses create or replace for functions", () => {
    const creates = code.match(/create (or replace )?function/gi) ?? [];
    expect(creates.length).toBe(Object.keys(RPC).length);
    for (const c of creates) expect(c.toLowerCase()).toBe("create or replace function");
    for (const name of Object.values(RPC)) {
      expect(code).toContain(`create or replace function public.${name}(`);
    }
  });

  it("adds the columns that came after the first version with add column if not exists", () => {
    expect(code).toMatch(
      /alter table public\.inquiry_forms\s+add column if not exists draft_saved_at timestamptz not null default now\(\);/,
    );
    expect(code).toMatch(/alter table public\.inquiry_submissions\s+add column if not exists crm_claimed_at timestamptz;/);
    // A column add that is not guarded would fail on the second run.
    const adds = code.match(/add column[^\n]*/gi) ?? [];
    // At least those two (a hub may add its own guarded columns, e.g. Y? leads.inquiry_submission_id).
    expect(adds.length).toBeGreaterThanOrEqual(2);
    for (const a of adds) expect(a.toLowerCase()).toContain("add column if not exists");
  });

  it("moves the old settings._draftSavedAt token into draft_saved_at and drops the key", () => {
    expect(code).toContain("set draft_saved_at = (settings ->> '_draftSavedAt')::timestamptz");
    expect(code).toContain("set settings = settings - '_draftSavedAt'");
    expect(code).toContain("where settings ? '_draftSavedAt';");
  });

  it("adds constraints only inside a pg_constraint guard", () => {
    const adds = code.match(/add constraint/gi) ?? [];
    expect(adds.length).toBe(1);
    const at = code.indexOf("add constraint");
    const before = code.slice(Math.max(0, at - 400), at);
    expect(before).toContain("if not exists (");
    expect(before).toContain("from pg_constraint");
  });

  it("every insert ignores rows that already exist", () => {
    const inserts = code.match(/insert into public\.(inquiry_settings|changelog_entries)[\s\S]*?;/gi) ?? [];
    expect(inserts.length).toBe(hubHasChangelogTable ? 2 : 1);
    for (const statement of inserts) expect(statement.toLowerCase()).toContain("on conflict");
  });
});

describe("the migration's security", () => {
  it("enables RLS on every table", () => {
    for (const table of Object.values(TABLES)) {
      expect(code).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("has no anon policy and revokes anon table access", () => {
    expect(code).not.toMatch(/to anon\b/);
    for (const table of Object.values(TABLES)) {
      expect(code).toContain(`revoke all on table public.${table} from anon;`);
    }
  });

  it("gives the rate limit table no policy at all (service role only)", () => {
    expect(code).not.toMatch(/create policy "[^"]*" on public\.inquiry_rate_limits/);
  });

  it("revokes every function from public, anon and authenticated by name, and grants only the service role", () => {
    for (const name of Object.values(RPC)) {
      const args = RPC_SIGNATURES[name];
      expect(code).toContain(`revoke all on function public.${name}(${args}) from public, anon, authenticated;`);
      expect(code).toContain(`grant execute on function public.${name}(${args}) to service_role;`);
    }
    expect(code).not.toMatch(/security definer/i);
  });

  it("claims a CRM write only while nothing is linked and nobody holds it", () => {
    const at = code.indexOf(`create or replace function public.${RPC.crmClaim}(p_id uuid, p_stale_seconds integer default null)`);
    expect(at).toBeGreaterThan(-1);
    const body = code.slice(at, code.indexOf("$$;", at));
    expect(body).toContain("set crm_claimed_at = now()");
    expect(body).toContain("where s.id = p_id");
    // No complete record: empty, or a half-done write (its retry reuses the client).
    expect(body).toContain("coalesce(s.crm_ref, '{}'::jsonb) = '{}'::jsonb");
    expect(body).toContain(`s.crm_ref ->> '${CRM_PARTIAL_KEY}' = 'true'`);
    // Free, or (only when the caller asks) abandoned for longer than p_stale_seconds.
    expect(body).toContain("s.crm_claimed_at is null");
    expect(body).toContain("p_stale_seconds is not null and s.crm_claimed_at < now() - p_stale_seconds * interval '1 second'");
    expect(body).toContain("returning jsonb_build_object('claimed_at', s.crm_claimed_at, 'crm_ref', s.crm_ref)");
  });

  it("adds the changelog entry only where the hub keeps its changelog in the database", () => {
    const at = code.indexOf("insert into public.changelog_entries");
    if (!hubHasChangelogTable) {
      expect(code).not.toContain("changelog_entries");
      return;
    }
    expect(at, "Y? adds its What's New entry inside the migration").toBeGreaterThan(-1);
    const values = code.slice(at, at + 400);
    expect(values).toMatch(/'feature'|'improvement'|'fix'/);
  });
});

describe("column guards", () => {
  it("accepts only real calendar dates for date columns", () => {
    expect(isCalendarDate("2027-05-15")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2027-02-29")).toBe(false);
    expect(isCalendarDate("2027-02-30")).toBe(false);
    expect(isCalendarDate("2027-13-01")).toBe(false);
    expect(isCalendarDate("2027-5-15")).toBe(false);
    expect(isCalendarDate("0001-01-01")).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
  });

  it("rounds integers into the Postgres range", () => {
    expect(toDbInt(150)).toBe(150);
    expect(toDbInt(12.6)).toBe(13);
    expect(toDbInt(-1)).toBeNull();
    expect(toDbInt(3e9)).toBeNull();
    expect(toDbInt("150")).toBeNull();
    expect(toDbInt(Number.NaN)).toBeNull();
  });
});

describe("the migration's house writing rules", () => {
  it("has no em or en dashes", () => {
    expect(sql).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`));
  });
});
