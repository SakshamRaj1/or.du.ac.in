#!/usr/bin/env python3
"""Fetch the notices and PDFs published on the department's official website.

    python scripts/fetch_official_updates.py            # list what is on the site
    python scripts/fetch_official_updates.py --download # also save the PDFs

Only the Python standard library is needed. Run it from the repository root.
Downloaded files go to document/official/ (existing files are never overwritten)
and a manifest.json records every link that was found, so you can compare it
with the notices listed in index.html, nae.html and academics.html.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date
from html.parser import HTMLParser

SITE = "https://or.du.ac.in/"
PAGES = ["", "Notice", "Programmes-Offered/Master-of-Operational-Research",
         "Programmes-Offered/Ph.D.-in-Operational-Research", "Campus-Placement",
         "Alumni", "Committees", "Gallery", "Faculty"]
OUT_DIR = os.path.join("document", "official")


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self._href, self._text = [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join("".join(self._text).split())))
            self._href = None


def extract_links(html, base):
    """Return [(absolute_url, link_text)] for every link with a real destination."""
    parser = LinkParser()
    parser.feed(html)
    found = []
    for href, text in parser.links:
        href = href.strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urllib.parse.urljoin(base, href)
        # spaces in the site's file names are legal in browsers but not in urllib
        absolute = urllib.parse.quote(absolute, safe=":/?&=%#+,()~'!*;@$-_.")
        found.append((absolute, text))
    return found


def is_pdf(url):
    return urllib.parse.urlparse(url).path.lower().endswith(".pdf")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "or-du-ac-in-sync/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--download", action="store_true", help="save PDFs hosted on or.du.ac.in")
    args = ap.parse_args()

    manifest, seen = [], set()
    for page in PAGES:
        url = urllib.parse.urljoin(SITE, page)
        try:
            html = fetch(url).decode("utf-8", errors="replace")
        except Exception as exc:                       # network or HTTP error
            print(f"! could not read {url}: {exc}", file=sys.stderr)
            continue
        for link, text in extract_links(html, url):
            if link in seen or not (is_pdf(link) or "admission.uod.ac.in" in link or "du.ac.in/uploads" in link):
                continue
            seen.add(link)
            manifest.append({"title": text, "url": link, "found_on": url})

    print(f"{len(manifest)} notice / document links found on the official site\n")
    for item in manifest:
        print(f"- {item['title'] or '(no text)'}\n  {item['url']}")

    if args.download:
        os.makedirs(OUT_DIR, exist_ok=True)
        for item in manifest:
            if not (is_pdf(item["url"]) and urllib.parse.urlparse(item["url"]).netloc.endswith("or.du.ac.in")):
                continue
            name = os.path.basename(urllib.parse.unquote(urllib.parse.urlparse(item["url"]).path))
            target = os.path.join(OUT_DIR, name)
            if os.path.exists(target):
                continue
            try:
                with open(target, "wb") as fh:
                    fh.write(fetch(item["url"]))
                print(f"saved {target}")
            except Exception as exc:
                print(f"! failed {item['url']}: {exc}", file=sys.stderr)
                if os.path.exists(target):
                    os.remove(target)
        with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as fh:
            json.dump({"checked": date.today().isoformat(), "links": manifest}, fh, indent=2, ensure_ascii=False)
        print(f"\nmanifest written to {os.path.join(OUT_DIR, 'manifest.json')}")


if __name__ == "__main__":
    main()
