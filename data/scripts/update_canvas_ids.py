import os
import sys
import json


def main(manifest_path: str, annotation_page_folder: str):
    with open(manifest_path) as f:
        manifest = json.load(f)

    for canvas in manifest["items"]:
        canvas_id = canvas["id"]

        # Extract the scan name from the metadata
        scan_name = [
            m["value"]["none"][0]
            for m in canvas["metadata"]
            if m["label"]["en"][0] == "Filename"
        ][0]

        annotation_page_path = os.path.join(annotation_page_folder, f"{scan_name}.json")
        with open(annotation_page_path) as f:
            annotation_page = json.load(f)

        print(f"Updating annotation page for {scan_name} with canvas ID {canvas_id}")
        for annotation in annotation_page["items"]:
            annotation["target"]["source"] = canvas_id

        with open(annotation_page_path, "w") as f:
            json.dump(annotation_page, f, indent=2)


if __name__ == "__main__":

    manifest_path = sys.argv[1] if len(sys.argv) > 1 else "manifest.json"
    annotation_page_folder = sys.argv[2] if len(sys.argv) > 2 else "results"

    if not os.path.exists(manifest_path):
        print(f"Manifest file not found: {manifest_path}")
        sys.exit(1)
    if not os.path.exists(annotation_page_folder):
        print(f"Annotation page folder not found: {annotation_page_folder}")
        sys.exit(1)

    main(manifest_path, annotation_page_folder)
