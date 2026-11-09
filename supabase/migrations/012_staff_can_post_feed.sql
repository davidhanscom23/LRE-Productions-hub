-- Allow staff to post to the company feed (create only).
-- Trainers may delete their own posts; admins may delete any.
-- Staff cannot delete posts.

drop policy if exists "Admins and trainers can insert posts" on public.posts;

create policy "Authenticated users can insert own posts"
on public.posts
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'trainer', 'staff')
  and author_id = auth.uid()
);

drop policy if exists "Authors and admins can delete posts" on public.posts;

create policy "Trainers delete own posts; admins delete any"
on public.posts
for delete
to authenticated
using (
  public.is_admin()
  or (
    author_id = auth.uid()
    and public.current_user_role() = 'trainer'
  )
);
