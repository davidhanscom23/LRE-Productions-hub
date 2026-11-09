export type MeetingAnalysisData = {
  strengths?: string[];
  improvements?: string[];
};

export type MeetingNote = {
  id: string;
  title: string;
  meeting_date: string | null;
  transcript: string;
  summary: string;
  quality_score: number | null;
  analysis: MeetingAnalysisData;
  analyzed_at: string | null;
  created_at: string;
};

export type MeetingNoteListItem = {
  id: string;
  title: string;
  meeting_date: string | null;
  quality_score: number | null;
  analyzed_at: string | null;
  created_at: string;
};

export type MeetingActionItemRow = {
  id: string;
  meeting_id: string;
  text: string;
  owner: string;
  due_date: string | null;
  status: "open" | "done";
  created_at: string;
  /** Joined. */
  meeting_title?: string | null;
};
