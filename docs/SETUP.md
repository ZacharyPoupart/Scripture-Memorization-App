# Setting up: GitHub → Cloudflare → your phone

You only do this once. Total time: about 20 minutes.

## 1. Get the code into GitHub
The repository `ZacharyPoupart/Scripture-Memorization-App` already exists and the work is on the branch `claude/peaceful-keller-gugrq4`.

1. Open https://github.com/ZacharyPoupart/Scripture-Memorization-App and switch to the branch **claude/peaceful-keller-gugrq4** (branch dropdown, top left).
2. Make it your `main` branch: in the branch dropdown type `main` and choose **Create branch: main from claude/peaceful-keller-gugrq4**. (If GitHub already created a `main`, open a pull request from the work branch into `main` and merge it instead.)
3. *Settings → Branches → Default branch* → make sure it is `main`.
4. Protect `main` so a failing test blocks merging: *Settings → Branches → Add branch ruleset* (or *Add rule*) for `main` → tick **Require a pull request before merging** and **Require status checks to pass** → search for and add **test** (it appears after CI has run once) → Save.
5. *Settings → Actions → General → Workflow permissions* → choose **Read and write permissions** (so the release workflow can tag versions).

## 2. Connect Cloudflare Pages (live site + preview links)
1. Create a free account at https://dash.cloudflare.com if you don't have one.
2. *Workers & Pages → Create → Pages → Connect to Git* → authorize GitHub → pick `Scripture-Memorization-App`.
3. Settings:
   - Production branch: `main`
   - Framework preset: *None*
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `20`
4. *Save and Deploy.* In a minute you get a URL like `https://memorize-for-life.pages.dev` — that's your live app.
5. Preview links: every branch and pull request is deployed automatically to its own URL (shown in the PR as a comment/check from Cloudflare). *Settings → Builds → Branch control* should be set to **All non-production branches**.
6. Optional custom domain: *Custom domains → Set up a domain*.

### Optional: turn on sync
1. *Workers & Pages → KV → Create a namespace* → name it `memorize-sync`.
2. Your Pages project → *Settings → Bindings → Add → KV namespace* → Variable name **`SYNC`** → choose the namespace. Do it for **Production**; for **Preview** pick a second namespace (e.g. `memorize-sync-preview`) so tests never touch real data.
3. *Deployments → Retry deployment* (or push any change). Sync now works: Settings → *Turn on sync*.

## 3. Install the app on your iPhone
1. Open your live URL (`https://….pages.dev`) in **Safari** (it must be Safari).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open it from the new home-screen icon — it runs full screen. Walk through the intro, add a verse, and you're set. After the first open it works with no signal at all.
4. To pick up updates: just open the app. If an **Update** banner appears at the top, tap it.

**Keep your verses safe:** in Settings, turn on sync *and/or* tap **Export backup** now and then (the app shows when you last did). Backups are a small `.json` file you can save to iCloud Drive.

## 4. Link your computer to your phone (sync)
1. Phone: Settings → **Turn on sync** → the 20-character code appears (**keep it private**).
2. Computer: open the live URL → Settings → **I have a code** → type the code → *Link this device*.
3. Changes merge automatically in both directions; it also works offline and catches up later.

## 5. Day-to-day workflow with Claude Code
1. Ask for a change; Claude works on its own branch and runs the tests.
2. Claude opens a pull request (what changed, how it was tested, version bump).
3. CI runs; Cloudflare posts a **preview link** — open it on your phone and try the change.
4. Happy? Merge. Cloudflare deploys it and a new version tag appears. Not happy? Say so, or roll back (README → *Rolling back*).
