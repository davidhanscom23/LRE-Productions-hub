/**
 * Inquiry Forms admin: submission shapes shared by the server actions, the Submissions tab and the drawer.
 * PURE module (types only).
 */
import type {
  Attribution,
  DateResult,
  LocationResult,
  Qualification,
  ScoreLabel,
  SubmissionStage,
} from "@/lib/inquiry-forms/types";

export type StageFilter = SubmissionStage | "all";

/** One table row of the Submissions tab (listSubmissions rows). */
export interface SubmissionListRow {
  id: string;
  createdAt: string;
  stage: SubmissionStage;
  name: string | null;
  email: string | null;
  phone: string | null;
  eventDate: string | null;
  score: number | null;
  scoreLabel: ScoreLabel | null;
  dateResult: DateResult | null;
  locationResult: LocationResult | null;
  /** Plain-language traffic source, e.g. "google / cpc", "Google Ads", "example.com", "Direct". */
  source: string;
  crmHref: string | null;
}

export interface SubmissionFunnel {
  views: number;
  starts: number;
  completes: number;
  /** perStepReached[i] = submissions (spam excluded) that reached step i. */
  perStepReached: number[];
  /** Step names in form order (published version, else the draft). Same length as perStepReached. */
  stepLabels?: string[];
  /** How many days the counts cover. */
  windowDays?: number;
}

export interface SubmissionListResult {
  rows: SubmissionListRow[];
  total: number;
  funnel: SubmissionFunnel;
  page?: number;
  pageSize?: number;
  /** Set when the list could not be loaded (the rows are then empty). */
  error?: string;
  /** true when the inquiry tables do not exist yet (the Inquiry Forms migration has not been run). */
  needsMigration?: boolean;
}

export interface SubmissionLogEntry {
  at: string;
  kind: string;
  status: string;
  channel: string | null;
  recipient: string | null;
}

/** getSubmissionDetail payload. The fields after `completedAt` extend the base contract for the drawer. */
export interface SubmissionDetail {
  id: string;
  formId: string;
  stage: SubmissionStage;
  lines: string[];
  qualification: Qualification;
  score: number | null;
  scoreLabel: ScoreLabel | null;
  attribution: Attribution;
  crmHref: string | null;
  log: SubmissionLogEntry[];
  startedAt: string;
  completedAt: string | null;
  formName: string;
  createdAt: string;
  lastActivityAt: string | null;
  abandonedAt: string | null;
  contact: { name: string | null; email: string | null; phone: string | null };
  eventDate: string | null;
  currentStep: number;
  totalSteps: number;
  spamReason: string | null;
  /** true when the CRM record is missing and the drawer may offer "Add to Leads". */
  canAddToCrm: boolean;
  /** true while a CRM write holds the claim (claimed in the last 10 minutes, no record yet). */
  crmBusy: boolean;
}
