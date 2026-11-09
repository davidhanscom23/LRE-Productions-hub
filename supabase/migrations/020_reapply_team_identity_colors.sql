-- Re-apply the known team identity colors.
-- Safe to run anytime: only updates rows whose first name (or exact full_name)
-- matches the list below. Does not clear colors for other people.

update public.profiles as p
set color = upper(v.color)
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
