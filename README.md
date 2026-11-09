# Match Play Mental Tracker

An offline-first Progressive Web App for fast courtside observation of a tennis player's tactical choices, execution, movement, and point outcomes at 30–0, 40–0, 40–15, and 40–30.

The app has no backend, account, analytics, advertising, paid API, or subscription. Records are kept in IndexedDB on the device where they were entered. The production build is ready for free GitHub Pages hosting and uses relative asset paths, so it works at `https://USERNAME.github.io/REPOSITORY/`.

## What is included

- Session start, end, resume, restore-after-reload, and local history
- Fast point recording with double-fault-specific rules and separate likely-cause analysis
- Immediate statistics overall and by score, with Serving/Returning filters and sample sizes
- Historical review, point editing/deletion, session comparison, and filtered metrics
- Copy Records, CSV, single-session JSON, full JSON backup/import, printable report/PDF, and blank observation sheet
- IndexedDB persistence, offline service worker, installable PWA manifest, generated 192 px and 512 px icons
- Light and dark themes, outdoor-friendly contrast, large touch controls, iPhone safe-area support
- Automated calculation/export tests and GitHub Actions deployment

## Privacy and backups

The player identifier is optional; use initials or a private code rather than a full name. Records never leave the browser automatically. There is no cloud synchronization. Safari website-data removal, device loss, or browser reset can remove local records, so use **Reports → Full Backup** regularly and store the downloaded JSON file somewhere appropriate and secure.

## Run and test locally

Node.js 20 or newer is recommended. There are no runtime packages to download.

```bash
npm test
npm run build
npx serve dist
```

If `npx serve` is unavailable, serve `dist` with any local static server. Do not open `index.html` directly with a `file://` URL because service workers require HTTP(S). The built application is entirely contained in `dist/`.

## Publish for free with GitHub Pages

### 1. Create a public repository

1. Sign in at [github.com](https://github.com/).
2. Select **New repository**.
3. Enter a name such as `match-play-mental-tracker`.
4. Choose **Public**. GitHub Pages is free for public repositories.
5. Leave the optional starter files unchecked, then select **Create repository**.

### 2. Push this project

From this project folder, replace `YOUR-USERNAME` with the GitHub account name:

```bash
git init
git add .
git commit -m "Build Match Play Mental Tracker PWA"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/match-play-mental-tracker.git
git push -u origin main
```

Alternatively, on the repository page choose **Add file → Upload files**, upload the project contents including the hidden `.github` folder, and commit to the `main` branch. GitHub's web uploader may not display hidden folders conveniently; pushing with Git is more reliable.

### 3. Enable GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for **Deploy Match Play Mental Tracker** to finish with a green check. The workflow tests the calculations, builds `dist`, and publishes it.

### 4. Get the public URL

After deployment, the URL appears in **Settings → Pages** and in the completed workflow. It will normally be:

```text
https://YOUR-USERNAME.github.io/match-play-mental-tracker/
```

The repository and application URL are public, but player records are not part of the repository: they remain inside each browser's local IndexedDB unless deliberately exported.

## Install on iPhone

1. Open the GitHub Pages URL in **Safari** on the iPhone. Do not use an in-app browser from Messages, Gmail, or another app.
2. Wait for the Track screen to finish loading once while online.
3. Tap Safari's **Share** button.
4. Scroll down and choose **Add to Home Screen**.
5. Keep the suggested name or shorten it, then tap **Add**.
6. Launch **Mental Tracker** from the new Home Screen icon.

No Apple Developer account or App Store installation is needed.

## Verify offline operation

1. While online, open the installed app at least once and wait a few seconds so its shell is cached.
2. Start a test session, add a point, and confirm that it appears under Recent points.
3. Close the app.
4. Enable Airplane Mode and turn Wi-Fi off.
5. Reopen the Home Screen app. The header should say **Offline ready**.
6. Confirm the session is restored, add another point, open Statistics and History, and export a file.
7. Reconnect. No manual synchronization is required because the records were already saved locally.

Service workers update the app shell without replacing IndexedDB. A new deployment therefore does not intentionally delete existing sessions.

## Export and restore backups

### Create a backup

1. Open **Reports**.
2. Tap **Full Backup**.
3. Save or share the `.json` file to an appropriate secure location.

### Restore a backup

1. Open **Reports** on the destination device/browser.
2. Tap **Import Backup** and select a Match Play Mental Tracker JSON backup.
3. The file is validated before import.
4. Sessions whose IDs already exist are skipped, so an import does not silently overwrite or duplicate existing sessions.

Single-session JSON exports use the same restorable format. CSV is point-level and intended for Excel or Google Sheets; it is not a backup format.

## Printable PDF and paper sheet

Choose a session under **Reports**, then tap **Printable PDF**. In the browser print sheet, print directly or use the system's PDF/save/share option. **Blank Sheet** produces an empty observation form with a compact category legend. Layouts are designed for both A4 and US Letter.

## Data and calculation rules

- A Double Fault can only be selected while Serving.
- A Double Fault is one recorded point, one lost point, and one double fault—never two losses.
- Tactical decision, execution, movement/body language, and optional notes remain required/available for Double Fault observations just as for other points.
- Double Fault likely cause is stored separately and is never inferred from the tactical decision.
- Point win percentage = won points ÷ all recorded points.
- Committed execution percentage = committed ÷ observable executions; `Not observable` is excluded from the denominator.
- Double fault rate = double faults ÷ recorded serving points.
- A missing denominator displays `N/A`.

## Project structure

```text
src/                    Application source and service worker
src/js/db.js            IndexedDB persistence
src/js/stats.js         Pure statistics calculations
src/js/exports.js       Copy, CSV, JSON, print, and validation helpers
scripts/build.mjs       Dependency-free production build and icon generation
tests/                  Node test suite
dist/                   Production-ready GitHub Pages output
.github/workflows/      Test/build/deploy automation
```

## Browser support

The primary target is current Safari on iPhone. Current Chrome, Edge, Firefox, and Safari desktop browsers are also supported. IndexedDB must be available, and private browsing or managed-device policies may limit persistent website storage.

## License

MIT
