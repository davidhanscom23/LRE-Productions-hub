export type KbArticle = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export type RebuildResult = {
  ok: boolean;
  message: string;
  documents: number;
  chunks: number;
};

export type KbUploadResult = {
  ok: boolean;
  message: string;
};
