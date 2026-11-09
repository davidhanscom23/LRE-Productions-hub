"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { ChatChannel, ChatMessage } from "@/lib/types/chat";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: "You must be signed in." as const };
  }

  return { supabase, user, error: null as string | null };
}

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {
      supabase: await createClient(),
      profile: null,
      error: "You must be signed in." as const,
    };
  }
  if (profile.role !== "admin") {
    return {
      supabase: await createClient(),
      profile,
      error: "Only admins can manage channels." as const,
    };
  }
  return {
    supabase: await createClient(),
    profile,
    error: null as string | null,
  };
}

function normalizeChannelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

async function replaceChannelMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channelId: string,
  memberIds: string[],
  createdBy: string,
): Promise<string | null> {
  const unique = [...new Set(memberIds.filter(Boolean))];

  const { error: deleteError } = await supabase
    .from("channel_members")
    .delete()
    .eq("channel_id", channelId);
  if (deleteError) return deleteError.message;

  if (unique.length === 0) return null;

  const { error: insertError } = await supabase.from("channel_members").insert(
    unique.map((userId) => ({
      channel_id: channelId,
      user_id: userId,
      created_by: createdBy,
    })),
  );
  return insertError?.message ?? null;
}

export async function createChannelAction(input: {
  name: string;
  description?: string;
  isPrivate?: boolean;
  memberIds?: string[];
}): Promise<{ error: string | null; channel?: ChatChannel }> {
  const { supabase, profile, error } = await requireAdmin();
  if (error || !profile) return { error: error ?? "Unauthorized" };

  const name = normalizeChannelName(input.name);
  if (!name) return { error: "Give the channel a name." };

  const description = (input.description ?? "").trim();
  const isPrivate = Boolean(input.isPrivate);

  const { data, error: insertError } = await supabase
    .from("channels")
    .insert({
      name,
      description,
      created_by: profile.id,
      is_private: isPrivate,
    })
    .select("id, name, description, created_at, created_by, is_private")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "That channel name is already taken." };
    }
    return { error: insertError.message };
  }

  if (isPrivate) {
    const memberError = await replaceChannelMembers(
      supabase,
      data.id as string,
      input.memberIds ?? [],
      profile.id,
    );
    if (memberError) return { error: memberError };
  }

  revalidatePath("/chat");
  return {
    error: null,
    channel: {
      ...(data as Omit<ChatChannel, "is_private">),
      is_private: Boolean(
        (data as { is_private?: boolean }).is_private ?? isPrivate,
      ),
    },
  };
}

export async function renameChannelAction(input: {
  id: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  memberIds?: string[];
}): Promise<{ error: string | null }> {
  const { supabase, profile, error } = await requireAdmin();
  if (error || !profile) return { error: error ?? "Unauthorized" };

  const name = normalizeChannelName(input.name);
  if (!name) return { error: "Give the channel a name." };

  const patch: {
    name: string;
    description?: string;
    is_private?: boolean;
  } = { name };
  if (typeof input.description === "string") {
    patch.description = input.description.trim();
  }
  if (typeof input.isPrivate === "boolean") {
    patch.is_private = input.isPrivate;
  }

  const { error: updateError } = await supabase
    .from("channels")
    .update(patch)
    .eq("id", input.id);

  if (updateError) {
    if (updateError.code === "23505") {
      return { error: "That channel name is already taken." };
    }
    return { error: updateError.message };
  }

  if (typeof input.isPrivate === "boolean") {
    if (input.isPrivate) {
      const memberError = await replaceChannelMembers(
        supabase,
        input.id,
        input.memberIds ?? [],
        profile.id,
      );
      if (memberError) return { error: memberError };
    } else {
      // Public again — clear membership list (no longer used for access).
      const { error: clearError } = await supabase
        .from("channel_members")
        .delete()
        .eq("channel_id", input.id);
      if (clearError) return { error: clearError.message };
    }
  }

  revalidatePath("/chat");
  return { error: null };
}

export async function setChannelMembersAction(input: {
  channelId: string;
  memberIds: string[];
}): Promise<{ error: string | null }> {
  const { supabase, profile, error } = await requireAdmin();
  if (error || !profile) return { error: error ?? "Unauthorized" };

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("id, is_private")
    .eq("id", input.channelId)
    .maybeSingle();

  if (channelError) return { error: channelError.message };
  if (!channel) return { error: "Channel not found." };
  if (!channel.is_private) {
    return {
      error: "Switch the channel to “Selected people” before assigning members.",
    };
  }

  const memberError = await replaceChannelMembers(
    supabase,
    input.channelId,
    input.memberIds,
    profile.id,
  );
  if (memberError) return { error: memberError };

  revalidatePath("/chat");
  return { error: null };
}

export async function deleteChannelAction(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("channels")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/chat");
  return { error: null };
}

export async function sendMessageAction(input: {
  channelId: string;
  body: string;
}): Promise<{ error: string | null; message?: ChatMessage }> {
  const { supabase, user, error } = await requireUser();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const body = input.body.trim();
  if (!body) return { error: "Write a message first." };
  if (body.length > 4000) return { error: "Keep messages under 4,000 characters." };

  const { data, error: insertError } = await supabase
    .from("messages")
    .insert({
      channel_id: input.channelId,
      user_id: user.id,
      body,
    })
    .select("id, channel_id, user_id, body, created_at")
    .single();

  if (insertError) {
    if (/policy|permission|row-level/i.test(insertError.message)) {
      return {
        error: "You don’t have access to post in this channel.",
      };
    }
    return { error: insertError.message };
  }

  try {
    const { awardChatActivity } = await import("@/lib/points/earning");
    await awardChatActivity(supabase, user.id, {
      channelId: input.channelId,
      body,
      messageId: data.id as string,
    });
  } catch {
    // non-critical
  }

  const { data: author } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath("/chat");
  return {
    error: null,
    message: {
      ...(data as Omit<ChatMessage, "author">),
      author: author
        ? {
            id: author.id as string,
            full_name: (author.full_name as string) ?? "",
            email: (author.email as string) ?? "",
            avatar_url: (author.avatar_url as string | null) ?? null,
          }
        : null,
    },
  };
}

export async function deleteMessageAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireUser();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/chat");
  return { error: null };
}
