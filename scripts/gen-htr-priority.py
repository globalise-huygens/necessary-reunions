"""
Generate HTR priority JSON by matching TSV rows to manifest canvases.

Strategy:
1. Match by IIIF Info URL (direct service URL match)
2. Match by canvas label similarity (fuzzy + keyword)

Output: JSON keyed by canvas index (0-based) -> { priority, link? }

Usage: python3 scripts/gen-htr-priority-v2.py
"""
import json
import re
import os
import urllib.request
from difflib import SequenceMatcher

# Load manifest
url = "https://surinametimemachine.github.io/iiif-suriname/manifest.json"
with urllib.request.urlopen(url) as resp:
    m = json.load(resp)

items = m.get("items", [])

def get_label(canvas):
    label = canvas.get("label", {})
    if isinstance(label, dict):
        lv = list(label.values())[0] if label else ["?"]
        return lv[0] if isinstance(lv, list) else lv
    return str(label)

def get_image_service_ids(canvas):
    ids = set()
    for page in canvas.get("items", []):
        for anno in page.get("items", []):
            body = anno.get("body", {})
            if isinstance(body, dict):
                if body.get("id"):
                    ids.add(body["id"])
                for svc in (body.get("service") or []):
                    if isinstance(svc, dict):
                        sid = svc.get("id") or svc.get("@id")
                        if sid:
                            ids.add(sid)
    for img in canvas.get("images", []):
        res = img.get("resource", {})
        if res.get("@id") or res.get("id"):
            ids.add(res.get("@id") or res.get("id"))
        svc = res.get("service")
        svcs = [svc] if isinstance(svc, dict) else (svc or [])
        for s in svcs:
            if isinstance(s, dict):
                sid = s.get("id") or s.get("@id")
                if sid:
                    ids.add(sid)
    return ids

def normalize_url(u):
    return re.sub(r'/info\.json$', '', u).rstrip('/')

def normalize_for_compare(lbl):
    """Normalize for comparison: lowercase, strip punctuation, collapse ws."""
    s = lbl.lower().strip()
    s = re.sub(r'["\[\]().,;:!?\'"\u2018\u2019\u201c\u201d]', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def strip_archive_prefix(lbl):
    """Remove leading archive numbers like '6108 ', '16A401 ', 'MC766 '."""
    return re.sub(r'^[\dA-Za-z]+[\s\-]+', '', lbl, count=1).strip()

def extract_keywords(lbl, min_len=4):
    """Extract significant words from a label."""
    words = re.findall(r'[A-Za-z\u00C0-\u024F]{' + str(min_len) + r',}', lbl)
    # Filter common Dutch/generic words
    stop = {'kaart', 'van', 'het', 'een', 'met', 'der', 'den', 'des', 'voor',
            'kolonie', 'colonie', 'suriname', 'surinaame', 'riviere', 'rivier'}
    return [w.lower() for w in words if w.lower() not in stop]

# Build URL -> canvas index map
url_to_canvas = {}
for i, c in enumerate(items):
    for u in get_image_service_ids(c):
        url_to_canvas[normalize_url(u)] = i

# Build canvas data for matching
canvas_data = []
for i, c in enumerate(items):
    lbl = get_label(c)
    canvas_data.append({
        "index": i,
        "label": lbl,
        "norm": normalize_for_compare(lbl),
        "stripped": normalize_for_compare(strip_archive_prefix(lbl)),
        "keywords": extract_keywords(lbl),
    })

# Load TSV
tsv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                         "Surinaams kaartmateriaal - for HTR_OCR (5).tsv")
with open(tsv_path, "r") as f:
    lines = f.read().strip().split("\n")

# Parse TSV rows
tsv_rows = []
for row_idx in range(1, len(lines)):
    cols = lines[row_idx].split("\t")
    label = cols[6] if len(cols) > 6 else ""
    tsv_rows.append({
        "row": row_idx,
        "id": cols[0],
        "handle_a": cols[2].strip() if len(cols) > 2 else "",
        "prio": int(cols[3]) if len(cols) > 3 and cols[3].strip().isdigit() else 0,
        "label": label,
        "label_norm": normalize_for_compare(label),
        "label_stripped": normalize_for_compare(strip_archive_prefix(label)),
        "keywords": extract_keywords(label),
        "scans": int(cols[16]) if len(cols) > 16 and cols[16].strip().isdigit() else 1,
        "handle_b": cols[20].strip() if len(cols) > 20 else "",
        "iiif_manifest": cols[21].strip() if len(cols) > 21 else "",
        "iiif_info": cols[22].strip() if len(cols) > 22 else "",
    })

print(f"Manifest: {len(items)} canvases")
print(f"TSV: {len(tsv_rows)} rows\n")

# Step 1: Match by IIIF Info URL
matched_canvases = {}  # canvas_index -> tsv_row
matched_tsv = set()

for tr in tsv_rows:
    if tr["iiif_info"] and tr["iiif_info"] != "-":
        norm = normalize_url(tr["iiif_info"])
        if norm in url_to_canvas:
            ci = url_to_canvas[norm]
            matched_canvases[ci] = tr
            matched_tsv.add(tr["row"])

print(f"Step 1 (IIIF URL): {len(matched_tsv)} TSV rows matched")

# Step 2: For remaining TSV rows, match by label
unmatched_tsv = [tr for tr in tsv_rows if tr["row"] not in matched_tsv]
matched_canvas_set = set(matched_canvases.keys())

def compute_match_score(tr, cd):
    """Score how well a TSV row matches a canvas."""
    scores = []

    # Full normalized label similarity
    scores.append(SequenceMatcher(None, tr["label_norm"], cd["norm"]).ratio())

    # Stripped label similarity (without archive prefix)
    if tr["label_stripped"] and cd["stripped"]:
        scores.append(SequenceMatcher(None, tr["label_stripped"], cd["stripped"]).ratio())

    # Substring containment
    if len(tr["label_norm"]) > 8:
        if tr["label_norm"] in cd["norm"] or cd["norm"] in tr["label_norm"]:
            scores.append(0.9)
    if len(tr["label_stripped"]) > 8:
        if tr["label_stripped"] in cd["stripped"] or cd["stripped"] in tr["label_stripped"]:
            scores.append(0.85)

    # Keyword overlap
    if tr["keywords"] and cd["keywords"]:
        common = set(tr["keywords"]) & set(cd["keywords"])
        total = set(tr["keywords"]) | set(cd["keywords"])
        if total:
            kw_score = len(common) / len(total)
            if kw_score > 0:
                scores.append(kw_score * 0.8 + 0.1)

    # Archive/COLLBN number match
    tsv_codes = re.findall(r'COLLBN[\s\-]+[\w\-]+', tr["label"], re.IGNORECASE)
    if tsv_codes:
        canvas_codes = re.findall(r'COLLBN[\s\-]+[\w\-]+', cd["label"], re.IGNORECASE)
        for tc in tsv_codes:
            for cc in canvas_codes:
                if tc.replace(" ", "").lower() == cc.replace(" ", "").lower():
                    scores.append(0.95)

    return max(scores) if scores else 0

for tr in unmatched_tsv:
    if not tr["label_norm"]:
        continue

    best_score = 0
    best_canvas = -1

    for cd in canvas_data:
        if cd["index"] in matched_canvas_set:
            continue
        score = compute_match_score(tr, cd)
        if score > best_score:
            best_score = score
            best_canvas = cd["index"]

    if best_score >= 0.45 and best_canvas >= 0:
        matched_canvases[best_canvas] = tr
        matched_canvas_set.add(best_canvas)
        matched_tsv.add(tr["row"])

        # For multi-scan entries, tag adjacent canvases with similar labels
        if tr["scans"] > 1:
            base_norm = normalize_for_compare(get_label(items[best_canvas]))[:40]
            for offset in range(1, tr["scans"] + 5):
                for ci2 in [best_canvas - offset, best_canvas + offset]:
                    if 0 <= ci2 < len(items) and ci2 not in matched_canvas_set:
                        other_norm = normalize_for_compare(get_label(items[ci2]))
                        sim = SequenceMatcher(None, base_norm, other_norm[:40]).ratio()
                        if sim > 0.6:
                            matched_canvases[ci2] = tr
                            matched_canvas_set.add(ci2)

print(f"Step 2 (label): {len(matched_tsv)} TSV rows matched, {len(matched_canvases)} canvases covered")

# Show some matches for verification
print("\n--- Sample matches (first 15) ---")
for ci in sorted(matched_canvases.keys())[:15]:
    tr = matched_canvases[ci]
    clabel = get_label(items[ci])[:60]
    print(f"  canvas {ci:3d} (prio={tr['prio']}): '{clabel}' <- TSV id={tr['id']} '{tr['label'][:40]}'")

# Key check
if 7 in matched_canvases:
    tr = matched_canvases[7]
    print(f"\n*** Canvas 7: prio={tr['prio']} from TSV id={tr['id']} '{tr['label'][:60]}'")
else:
    print("\n*** Canvas 7: NOT MATCHED")

# Unmatched
still_unmatched = [tr for tr in tsv_rows if tr["row"] not in matched_tsv]
if still_unmatched:
    print(f"\n--- {len(still_unmatched)} unmatched TSV rows ---")
    for tr in still_unmatched:
        print(f"  row {tr['row']} id={tr['id']}: {tr['label'][:60]}")

# Build output JSON keyed by canvas index (0-based)
result = {}
for ci, tr in matched_canvases.items():
    handle = tr["handle_a"]
    if not handle or handle == "-":
        handle = tr["handle_b"]
    if not handle or handle == "-":
        handle = tr["iiif_manifest"]
    if not handle or handle == "-":
        handle = None

    entry = {"priority": tr["prio"]}
    if handle:
        entry["link"] = handle
    result[str(ci)] = entry

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "suriname-htr-priority.json")
with open(out_path, "w") as f:
    json.dump(result, f, indent=2)

print(f"\nWrote {len(result)} entries to {out_path}")

counts = {}
for v in result.values():
    counts[v["priority"]] = counts.get(v["priority"], 0) + 1
print(f"By priority: {json.dumps(dict(sorted(counts.items())))}")
