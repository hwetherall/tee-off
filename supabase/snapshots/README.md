# Snapshots

`pre-shotgun.sql` is a restorable dump of the live tables taken before the
Aug 8 shotgun start.

Anonymous clients hold full read/write on every table (`schema.sql` grants
`for all to anon using (true) with check (true)`), and the anon key ships in the
browser bundle. That is a deliberate v1 choice, but it means anyone who opens
devtools can delete the ladder. If that happens mid-round:

1. Open the Supabase SQL editor for the project.
2. Paste the contents of `pre-shotgun.sql` and run it.

Every statement is an idempotent upsert keyed on `id`, so re-running it is safe
and will not duplicate rows. It restores teams and players; it also restores any
scores, claims, orders, envelopes, tickets and photos that existed when the
snapshot was taken (all empty at the pre-shotgun snapshot).

Note that it does **not** roll back newer legitimate scores. If you restore
mid-round, groups still holding unsynced holes on their phones will re-push them
on their next sync pass, which is the recovery path you want.

To retake a snapshot later, re-run the generator described in the launch notes.
