# Adds `youtube:` links to talk pages for videos that are public on the GVT YouTube channel.
# Reads the channel RSS feed (public videos only, the latest 15), so a video gets on the site after it is published.
# A video title has the form: GVT #<N> <Speaker> "<Talk title>". It is matched to a talk of event "GVT #<N>" that has
# no `youtube:` line, by speaker name (title similarity breaks a tie).
# Exit code 1 if a "GVT #<N>" video matches no talk (for example, the talk is not on the site yet): GitHub emails the owner.
# Videos without "GVT #<N>" in the title are not talks and are skipped.
# Run from the repo root: python .github/scripts/youtube_links.py [feed.xml]  (a file instead of the live feed, for tests)
import difflib
import html
import pathlib
import re
import sys
import unicodedata
import urllib.request

FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCubMRQnVK7G3ID23aaf2f5w"
TALKS = pathlib.Path("content/talks")


def norm(s):
    s = unicodedata.normalize("NFKD", s.replace("ł", "l").replace("Ł", "L"))
    return re.sub(r"[^a-z0-9 ]+", " ", "".join(c for c in s if not unicodedata.combining(c)).lower()).split()


def videos(xml):
    for vid, title in re.findall(r"<yt:videoId>([^<]+)</yt:videoId>.*?<title>([^<]+)</title>", xml, re.S):
        yield vid, html.unescape(title)


def field(text, key):
    m = re.search(rf'(?m)^{key}:\s*"?(.*?)"?\s*$', text)
    return m.group(1) if m else None


def set_youtube(text, url):
    line = f'youtube: "{url}"'
    if re.search(r"(?m)^youtube:", text):
        return re.sub(r"(?m)^youtube:.*$", line, text, count=1)
    if re.search(r"(?m)^cover:", text):
        return re.sub(r"(?m)^cover:", line + "\ncover:", text, count=1)
    head, sep, rest = text.partition("\n---")
    return head + "\n" + line + sep + rest


def match(title, talks):
    """talks: [(path, text)] of one event, without a youtube line. Returns the path, or None."""
    m = re.match(r'GVT #\d+\s+(.*?)\s*"(.*)"\s*$', title)
    speaker, topic = (m.group(1), m.group(2)) if m else (title, title)
    words = set(norm(speaker))
    scored = []
    for path, text in talks:
        names = norm((field(text, "speaker") or "").split(",")[0])
        same = len(words & set(names))
        sim = difflib.SequenceMatcher(None, " ".join(norm(topic)), " ".join(norm(field(text, "title") or ""))).ratio()
        if same or sim > 0.6:
            scored.append((same, sim, path))
    scored.sort(reverse=True)
    if not scored or (len(scored) > 1 and scored[0][:2] == scored[1][:2]):
        return None
    return scored[0][2]


def main(feed_file=None):
    xml = open(feed_file, encoding="utf-8").read() if feed_file else urllib.request.urlopen(FEED, timeout=30).read().decode()
    pages = {p: p.read_text(encoding="utf-8") for p in sorted(TALKS.glob("*.md"))}
    known = {m for t in pages.values() for m in re.findall(r"(?:youtu\.be/|v=)([\w-]{11})", t)}
    added, unmatched = [], []
    for vid, title in videos(xml):
        n = re.search(r"GVT #(\d+)", title)
        if vid in known or not n:
            continue
        free = [(p, t) for p, t in pages.items() if field(t, "event") == f"GVT #{n.group(1)}" and field(t, "youtube") is None]
        path = match(title, free)
        if path is None:
            unmatched.append(f"{vid} {title}")
            continue
        pages[path] = set_youtube(pages[path], f"https://youtu.be/{vid}")
        path.write_text(pages[path], encoding="utf-8")
        added.append(f"{path.name}: https://youtu.be/{vid} ({title})")
    for a in added:
        print("added", a)
    for u in unmatched:
        print("NO MATCHING TALK:", u)
    return 1 if unmatched else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(*sys.argv[1:]))
