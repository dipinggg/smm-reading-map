#!/usr/bin/env python3
"""Build the SMM Reading Map: one hub page plus one self-contained page per topic.
Usage:
  python3 build.py                 reads src/, writes dist/ (hub without a document skeleton, for a claude.ai artifact)
  python3 build.py OUTDIR --full   writes OUTDIR/ with a complete hub page, for GitHub Pages or any web host"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
FULL = "--full" in sys.argv
SRC = ROOT / "src"
DIST = pathlib.Path(args[0]).resolve() if args else ROOT / "dist"
DIST.mkdir(parents=True, exist_ok=True)

css = (SRC / "site.css").read_text()
catalog = (SRC / "catalog.js").read_text()
topic_js = (SRC / "topic.js").read_text()
ask_js = (SRC / "ask.js").read_text()
hub_js = (SRC / "hub.js").read_text()

# Glossary: term data, the widget, and the stop names it links to (read from each topic file).
STOPNAMES = {}
for tf in sorted((SRC / "topics").glob("*.js")):
    fa = re.search(r'file:"([^"]+)\.html"', tf.read_text())
    if fa:
        STOPNAMES[fa.group(1)] = {int(i): n for i, n in re.findall(r'\{id:(\d+),name:"([^"]+)"', tf.read_text())}
gdata = (SRC / "glossary-data.js").read_text()
bad = [f"{f} stop {n}" for f, n in re.findall(r'\["(m\d-[a-z-]+)",(\d+)\]', gdata)
       if f not in STOPNAMES or int(n) not in STOPNAMES[f]]
if bad:
    sys.exit("glossary links to missing pages or stops: " + ", ".join(sorted(set(bad))))
glossary = "window.STOPNAMES=" + json.dumps(STOPNAMES, ensure_ascii=False) + ";\n" + gdata + "\n" + (SRC / "glossary.js").read_text()
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700'
         '&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">')

def safe_script(s):
    return s.replace("</script", "<\\/script")

hub_head = f"""<title>SMM Reading Map</title>
{FONTS}
<style>
{css}
</style>"""
hub = f"""<header class="hubhero">
  <div class="wrap">
    <div class="eyebrow">22MDM32 Social Media Marketing · Lecture prep</div>
    <h1>SMM Reading Map</h1>
    <p class="lede">Pick a module, then a topic. Each topic has its own page: the essential stops with page numbers, a page-by-page skim guide for the primary books, a tier map, and reading lists in three tiers. Each module has its own colour, and its topic pages use it.</p>
    <div class="hubstats"><span><b id="statReady"></b> of <b id="statTotal"></b> topic pages ready</span><span>Book page numbers checked against the copies in your SMM and Resources folders</span></div>
    <div class="swatches" aria-label="Module colours">
      <span class="m1"><i></i>Module 1</span><span class="m2"><i></i>Module 2</span><span class="m3"><i></i>Module 3</span><span class="m4"><i></i>Module 4</span><span class="m5"><i></i>Module 5</span>
    </div>
  </div>
</header>
<main>
  <section class="block" style="padding-top:20px">
    <div class="wrap">
      <header>
        <div class="eyebrow">Road map · modules and topics</div>
        <h2>Five modules, forty topics</h2>
        <p>Modules follow the syllabus; topics follow your course plan's session order (S1–S40). Tap a module to open its topics. Topics marked Ready have a page; the rest will be added as you reach them.</p>
      </header>
      <ul class="modules" id="modules"></ul>
    </div>
  </section>
  <section class="block">
    <div class="wrap">
      <header>
        <div class="eyebrow">On every topic page</div>
        <h2>Same layout, in the module's colour</h2>
      </header>
      <div class="howto">
        <div><b>Road map</b><p>The essential stops for the hour, in teaching order, each with the book and page to read and a likely exam question.</p></div>
        <div><b>Tier 1 skim guide</b><p>Every page of the primary chapters, split into paragraphs, boxes and figures, each marked read, skim, glance or skip.</p></div>
        <div><b>Tier map and lists</b><p>Tier 1 is solid, Tier 2 lighter, Tier 3 dashed. Tap a box on the map to jump to that tier's readings or the skim guide.</p></div>
      </div>
    </div>
  </section>
</main>
<footer><div class="wrap">Built for the 22MDM32 lectures. Ticks and open modules are remembered in this browser only.</div></footer>
<script>
{safe_script(catalog)}
</script>
<script>
{safe_script(glossary)}
</script>
<script>
{safe_script(hub_js)}
</script>
"""
if FULL:
    hub_page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                + hub_head + '\n<style>[hidden]{display:none!important}body{margin:0}</style>\n</head>\n<body>\n'
                + hub + '</body>\n</html>\n')
else:
    hub_page = hub_head + "\n" + hub
(DIST / "index.html").write_text(hub_page)

made = []
for f in sorted((SRC / "topics").glob("*.js")):
    data = f.read_text()
    m = re.search(r'module:"(m\d)"', data)
    t = re.search(r'title:"([^"]+)"', data)
    fileattr = re.search(r'file:"([^"]+)"', data)
    if not (m and t and fileattr):
        sys.exit(f"missing module/title/file in {f.name}")
    page = f"""<!doctype html>
<html lang="en" class="{m.group(1)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t.group(1)} · SMM Reading Map</title>
{FONTS}
<style>
{css}
[hidden]{{display:none!important}}
img{{max-width:100%}}
:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}
</style>
</head>
<body>
<div id="app"></div>
<script>
{safe_script(catalog)}
</script>
<script>
{safe_script(glossary)}
</script>
<script>
{safe_script(data)}
</script>
<script>
{safe_script(topic_js)}
</script>
<script>
{safe_script(ask_js)}
</script>
</body>
</html>
"""
    (DIST / fileattr.group(1)).write_text(page)
    made.append(fileattr.group(1))
print("built index.html +", ", ".join(made))
