-- Scripted first-time-user tutorial: a linear sequence of guidance messages
-- driven by profiles.tutorial_step. New accounts start at 'welcome' and
-- progress through: welcome -> cursus_or_fight -> unlocks -> codex ->
-- training -> done. Two steps carry a gameplay mechanic alongside the
-- message (see game.functions.ts): the fight completed during
-- 'cursus_or_fight' is a guaranteed win, and the training session done
-- during 'training' is free (and capped to one session).
alter table public.profiles
  add column tutorial_step text not null default 'welcome';

-- Existing accounts skip the tutorial entirely — same "new accounts only"
-- treatment as discovered_buildings, so nobody who's already playing sees
-- a guided-tour dialog pop up out of nowhere.
update public.profiles
set tutorial_step = 'done'
where true;
