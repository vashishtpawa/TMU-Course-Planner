# TMU Course Planner

A personal, browser-based course and work-term planner for TMU Business Technology Management. A new plan starts empty with the default BTM classifications and targets. Use **Add year**, **Add unscheduled course**, or **Import transcript** to get started. Returning users keep their saved plan, including any example entries they edited. **Start fresh** and **Clear all data** ask for confirmation, then return the planner to its empty defaults.

## Run locally

To use all features, including PDF import, start a static server with Python 3 from this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Keep using the same URL and browser profile to reopen your saved plan.

You can also open `dist/index.html` directly for planning and JSON backups. PDF import needs localhost or a hosted URL to load the PDF worker. Browser storage for the direct file is separate from localhost.

## Import a TMU transcript

On **Year planner**, choose **Import transcript** or drop a text-based TMU transcript PDF onto the import area. Review the terms, courses, grades, grade points, credits, and notes. Select **Course**, **Work term** when offered, or **Skip** for each entry. Choose **Import selected entries** to add them to the existing plan. **Undo** reverses the whole import until the next edit or reload.

Possible duplicates start as **Skip**. Repeated attempts in different terms are kept separately. If a work term is already in the destination semester, the incoming entry can be skipped or imported as a course. Review special grades and any flagged rows against the PDF. The importer supports text-based PDFs up to 25 MB and scans require a text-based replacement. The planner's simple GPA average can differ from TMU's official GPA.

The browser reads the PDF using the bundled PDF.js 6.5.438 library, worker, fonts, and CMaps in `dist/vendor/pdfjs/`. The PDF and personal identifier fields are not saved or uploaded. Only the reviewed entries you import are saved in browser storage. The bundled library and its assets include their licenses. [PDF.js project](https://github.com/mozilla/pdf.js/)

## Deploy as a static site

Upload the contents of `dist/` to a static web host, with `index.html` at the root of the published directory. For a Git-connected host, set the publish directory to `dist` and leave the build command empty. The app uses relative asset paths and hash-based navigation, so it can also live in a subdirectory. No backend, account, environment variables, or build step is required to use it.

On Vercel, use the **Other** framework preset and set **Output Directory** to `dist`. For a GitHub-linked project tracking `main` as production, run:

```sh
git add README.md dist/app.js dist/index.html dist/model.js dist/styles.css dist/transcript.mjs dist/vendor/pdfjs
git diff --cached --stat
git commit -m "Add local TMU transcript import"
git push origin main
```

Vercel deploys the push to its configured production branch. [Vercel Git deployments](https://vercel.com/docs/git)

## Back up or transfer a plan

**Settings & data → Export JSON** downloads a copy of your plan. Use **Import JSON** in the receiving browser and confirm the replacement. Your working plan is stored in browser local storage for that site's origin. Different browsers, profiles, URLs, and devices have separate storage. Export a backup before switching URLs or clearing browser data.

## Planning details

- Academic years sort automatically by their Fall calendar year. Edit that semester's calendar year to change where the academic year appears. Course names are optional.

- Use a course's action button to move, duplicate, or delete it. Desktop users can also drag a course into another semester.
- Semester and academic-year action buttons and right-click menus offer bulk course status changes. Undo is available for the most recent reversible change until you make another edit or reload.
- Core and Unclassified start without targets. Other defaults come from the requested starter plan. Adjust targets and add tags in **Settings & data**.
- Suggestions use entered courses and calendar dates. They compare course counts first and compare total difficulty when both semesters have complete ratings. Review eligibility, availability, and double-counting rules with TMU.
