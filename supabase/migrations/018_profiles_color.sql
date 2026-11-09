-- Per-person identity color for directory cards, calendar chips, and sidebar legend.

alter table public.profiles
  add column if not exists color text;

alter table public.profiles
  drop constraint if exists profiles_color_hex_check;

alter table public.profiles
  add constraint profiles_color_hex_check
  check (
    color is null
    or color ~ '^#[0-9A-Fa-f]{6}$'
  );

comment on column public.profiles.color is
  'Optional #RRGGBB identity color for cards, calendar chips, and the team legend.';

-- Seed the initial team colors by first name (or exact full_name match).
update public.profiles as p
set color = v.color
from (
  values
    ('David', '#0084C6'),
    ('Brandon', '#4C62C6'),
    ('Golden', '#CCC900'),
    ('Hector', '#9B7C56'),
    ('Jake', '#0A8043'),
    ('Bible', '#AD1357'),
    ('Shane', '#1D00C4'),
    ('Wanda', '#B127AE')
) as v(first_name, color)
where
  lower(split_part(trim(coalesce(p.full_name, '')), ' ', 1)) = lower(v.first_name)
  or lower(trim(coalesce(p.full_name, ''))) = lower(v.first_name);
