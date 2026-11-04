# StreetWise ZW Agent Instructions

## Project setup summary

This repository is a Turborepo monorepo with:

- `apps/api` for the NestJS API (TypeORM + PostgreSQL)
- `apps/mobile` for the Flutter app (Android + Flutter web)
- `packages/shared` for shared TS types, enums and zod contracts

### One-time bootstrap

From `/Users/dennismarumahoko/street-wise`:

1. Install dependencies

```bash
pnpm install
```

2. Copy the local environment template (`.env.example` is the deployment template and does not validate locally)

```bash
cp .env.local.example .env
```

3. Start local infra (PostgreSQL on 5436, Redis on 6381)

```bash
make up
```

4. Create the schema and seed the Harare CBD cameras

```bash
pnpm db:migrate
pnpm db:seed
```

5. Start local apps

```bash
pnpm dev            # API on http://localhost:4100, Swagger at /docs
pnpm mobile:web     # Flutter app in Chrome
```

6. Stop local infra when done

```bash
make down
```

## Workspace commands

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm mobile:analyze`, `pnpm mobile:test`, `pnpm mobile:build:web`

## Agent operating rules (mandatory)

1. **No worktrees** are allowed under this repository. Do not create or use `git worktree` for this work.
2. All agent-authored changes must be committed and pushed when completed.
3. Commit all intentional task-related changes only.
4. After editing, run source-control completion workflow:
   - `git status`
   - stage task files
   - commit with a clear message
   - push branch to remote
5. Keep task scope tight: do only requested changes and document assumptions in the commit message if needed.

### How to push to my repo

Remote is `origin` for:

`git@github.com-personal:dennydennie/street-wise.git`

(`github.com-personal` is the SSH host alias for the `dennydennie` GitHub account.)

Preferred flow:

```bash
git status
git add <changed-files>
git commit -m "feat(scope): describe change"
git push -u origin $(git rev-parse --abbrev-ref HEAD)
```

If your branch has no upstream yet:

```bash
git checkout -b feature/<short-task-name>
git add <changed-files>
git commit -m "feat(scope): describe change"
git push -u origin feature/<short-task-name>
```

If you must push `main` directly:

```bash
git checkout main
git add <changed-files>
git commit -m "feat(scope): describe change"
git push origin main
```
