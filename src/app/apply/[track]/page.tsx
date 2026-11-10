import { notFound } from "next/navigation";
import { ApplyTrackForm } from "@/components/hiring/apply-track-form";
import {
  APPLY_TRACK_SLUGS,
  getApplyTrack,
  type ApplyTrackSlug,
} from "@/lib/hiring/apply-tracks";

type PageProps = {
  params: Promise<{ track: string }>;
};

export function generateStaticParams() {
  return APPLY_TRACK_SLUGS.map((track) => ({ track }));
}

export async function generateMetadata({ params }: PageProps) {
  const { track: slug } = await params;
  const track = getApplyTrack(slug);
  if (!track) return { title: "Apply — LRE Productions" };
  return {
    title: `${track.label} application — LRE Productions`,
    description: track.assessmentIntro,
  };
}

export default async function ApplyTrackPage({ params }: PageProps) {
  const { track: slug } = await params;
  const track = getApplyTrack(slug);
  if (!track) notFound();
  return <ApplyTrackForm track={track} />;
}

// Satisfy TypeScript when slug union is used elsewhere
export type { ApplyTrackSlug };
