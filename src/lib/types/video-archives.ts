export type ArchiveVideo = {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  category: string;
  year: number;
  presenter: string;
  topics: string[];
  tags: string[];
  zoom_recording_id: string;
  duration_seconds: number | null;
  published: boolean;
  created_at: string;
};

export type ArchiveVideoListItem = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  category: string;
  year: number;
  presenter: string;
  topics: string[];
  tags: string[];
};

export type ArchiveVideoAsset = {
  id: string;
  video_id: string;
  title: string;
  url: string;
  created_by: string | null;
  created_at: string;
};

export type ArchiveVideoChat = {
  id: string;
  video_id: string;
  ts_seconds: number;
  speaker: string;
  message: string;
};
