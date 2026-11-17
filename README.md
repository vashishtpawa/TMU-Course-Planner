# TMU Course Planner

A personal, browser-based course and work-term planner for TMU Business Technology Management. The initial plan contains labeled examples. Choose **Start fresh** to remove them and keep the default BTM classifications.

## Run locally

Open `dist/index.html` directly in your browser. Keep the other files in `dist/` alongside it. Browser storage for the file is separate from the localhost version. To move an existing plan, use **Export JSON** in the original version and **Import JSON** in the new one.

To use localhost instead, start a static server with Python 3 from this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Keep using the same URL and browser profile to reopen your saved plan.

## Deploy as a static site

Upload the contents of `dist/` to a static web host, with `index.html` at the root of the published directory. For a Git-connected host, set the publish directory to `dist` and leave the build command empty. The app uses relative asset paths and hash-based navigation, so it can also live in a subdirectory. No backend, account, environment variables, or build step is required to use it.

## Back up or transfer a plan

**Settings & data → Export JSON** downloads a copy of your plan. Use **Import JSON** in the receiving browser and confirm the replacement. Your working plan is stored in browser local storage for that site's origin. Different browsers, profiles, URLs, and devices have separate storage. Export a backup before switching URLs or clearing browser data.

## Planning details

- Academic years sort automatically by their Fall calendar year. Edit that semester's calendar year to change where the academic year appears. Course names are optional.

- Use a course's action button to move, duplicate, or delete it. Desktop users can also drag a course into another semester.
- Semester and academic-year action buttons and right-click menus offer bulk course status changes. Undo is available for the most recent reversible change until you make another edit or reload.
- Core and Unclassified start without targets. Other defaults come from the requested starter plan. Adjust targets and add tags in **Settings & data**.
- Suggestions use entered courses and calendar dates. They compare course counts first and compare total difficulty when both semesters have complete ratings. Review eligibility, availability, and double-counting rules with TMU.
