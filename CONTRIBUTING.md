# Contributing to Santul

Thanks for wanting to help. Santul is a small project, so these rules are short. They exist to keep the app correct, accessible and easy to review.

## Ways to contribute

- **Report a bug.** Open an [issue](https://github.com/shashwa7-dev/food-analyzer/issues/new) with what you did, what you expected, what happened, and your device and browser. A screenshot helps a lot for UI bugs.
- **Fix food data.** Wrong nutrition figures or a wrong grade? Open an issue with the food's name and a source for the right values.
- **Suggest a feature.** Open an issue describing the problem you want solved before proposing a solution.
- **Send code.** See below.

## Before you write code

1. For anything larger than a small fix, open an issue first and wait for a reply. It saves you from building something that won't be merged.
2. Set the app up locally: follow [Getting started](README.md#getting-started) in the README.
3. This project uses a recent Next.js with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before using a Next.js API from memory (see [`AGENTS.md`](AGENTS.md)).

## Rules for pull requests

- **Branch from `master`**, and open the pull request against `master`.
- **One change per pull request.** Don't mix a bug fix with a refactor or a feature.
- **All checks must pass.** CI runs them on every pull request; run them yourself first:

  ```bash
  pnpm lint        # ESLint, zero warnings allowed
  pnpm typecheck
  pnpm test        # unit tests, offline
  pnpm test:int    # integration tests, needs `pnpm db:up`
  ```

- **Add or update tests** for any behaviour you change. A bug fix should come with a test that fails without it.
- **Explain the change** in the pull request: what it does, why, and how you checked it. Add before and after screenshots for anything visual.
- **Keep the docs in step.** If you change a script, an environment variable or a behaviour the README describes, update the README in the same pull request.

## UI rules

The design is "Lime & Ink"; the [UI section of the README](README.md#ui) has the details. `pnpm ui:audit` checks these on every screen and must report 0 offenders:

- **Buttons never wrap.** If a label doesn't fit at 360 px, shorten it or let an icon carry it.
- **Lime is a fill, never text.** Use the ink tokens for text so it meets WCAG AA contrast.
- **Tap targets are at least 44 × 44 px.**
- **Use design tokens only** (`text-ink`, `bg-brand`…), never hex values or Tailwind palette colours.
- **Check phone and desktop, dark and light.** Most people use Santul on a phone.

## Database rules

- Change the schema with `pnpm db:generate`, then apply it with `pnpm db:migrate`.
- **Never use `drizzle-kit push`.** It would drop the `daily_ai_cost` view, which isn't declared in `schema.ts`.
- Migrations must be safe to run before the new code is deployed.

## Secrets and privacy

- **Never commit keys, tokens or `.env` files.** Local values go in `.env.local`, which is git-ignored.
- Don't add `NEXT_PUBLIC_` variables that hold secrets; anything with that prefix is sent to the browser.
- Don't log personal data (emails, food diaries, photos), and don't add analytics or third-party trackers.

## Food data

The catalogue is built from INDB (CC BY 4.0), USDA FNDDS (CC0) and Open Food Facts (ODbL). Only add data whose licence allows redistribution, and record it in [`data/sources/ATTRIBUTION.md`](data/sources/ATTRIBUTION.md).

## Reporting a security issue

Please don't open a public issue for a security problem. Use **Security → Report a vulnerability** on the GitHub repository to send a private report, with steps to reproduce. You'll get a reply as soon as possible.

## Be kind

Be respectful and constructive. Assume good intent, review the code and not the person, and keep discussions welcoming to newcomers.

## Licence

By contributing, you agree that your contribution is released under the project's [MIT licence](LICENSE).
