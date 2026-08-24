# Deploy Report: Goal Detail Preview

**Deploy mechanism**: Vercel, git-based — deploys automatically on push/merge to the connected branch (per `stack.yml: deploy_target`). No separate manual deploy step exists for this project.

**Status**: Not yet deployed. Per the user's explicit standing instruction for this pilot ("no bulk commits before FLIGHT completes"), nothing in this feature (or the rocket-core baseline upgrade alongside it) has been committed or pushed yet — this report records that RELEASE is ready and the code is deploy-ready, not that a live deploy has occurred.

**What will trigger the actual deploy**: A future, separate, user-approved commit + push of this feature's changes (kept in its own commit, apart from the rocket-core baseline upgrade, per the two-commit-split convention already established in this project).

**Post-deploy verification (deferred)**: Once pushed and Vercel completes the deploy, load `/notes` → Goals tab on the live URL and confirm a goal preview opens correctly, matching the same checks already performed manually in QA against the local dev server.
