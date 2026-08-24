# Deploy Report: Goal Item Completion Timestamp

**Deploy mechanism**: Vercel, git-based — deploys automatically on push/merge to the connected branch. No separate manual deploy step exists for the app code itself.

**Status**: Not yet deployed. Nothing has been pushed yet, per this dogfood session's standing practice of keeping local checkpoints until the user decides to push.

**Manual step required before deploy (not automated by anything in this repo)**: `sql/add_goal_items_completed_at.sql` must be run against the production Supabase database *before* this code goes live — this project has no automated migration runner (confirmed during CORRECTNESS review: `sql/*.sql` files are applied by hand). Deploying the code first would make every completion toggle and item save fail with a missing-column error until the SQL is run.

**What will trigger the actual deploy**: A future, separate, user-approved push of this feature's commit(s).

**Post-deploy verification (deferred)**: Once the SQL has been applied and the code is pushed, confirm on the live URL that toggling a goal item's completion (and editing an item via its "Done" checkbox) still works without error — no visible UI change to check, since `completed_at` has no display surface in this feature.
