# SMM Reading Map

Lecture-prep reading map for **22MDM32 Social Media Marketing** (BGS College of Engineering & Technology).

Open the site: the hub page lists the five modules. Tap a module to see its topics; topics marked **Ready** have their own page with:

- a road map of six essential stops, with book and page numbers;
- a page-by-page Tier 1 skim guide (read, skim, glance, skip);
- a clickable tier map (Tier 1 box → skim guide for that stop; Tier 2 / Tier 3 box → that reading list);
- reading lists in three tiers, plus lab tables.

Ready so far: S7 (strategies), S9–S14 (Module 2 content process).

## Updating the site

The pages are built from the files in `build/src/`.

```
python3 build/build.py . --full
```

run from the repository root rewrites `index.html` and the topic pages here. Add a topic by writing `build/src/topics/<file>.js` and adding `file:"<page>.html"` to that topic in `build/src/catalog.js`.

Ticks and open modules are saved in the viewer's own browser only.
