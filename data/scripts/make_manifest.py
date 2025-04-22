import os
import json
import hashlib
import requests
import pandas as pd
import iiif_prezi3

iiif_prezi3.config.configs["helpers.auto_fields.AutoLang"].auto_lang = "en"
iiif_prezi3.load_bundled_extensions()

PREFIX = "https://globalise-huygens.github.io/necessary-reunions/"


def make_manifest(df):

    manifest = iiif_prezi3.Manifest(
        id=f"{PREFIX}manifest.json",
        label="Selection of maps for the Necessity and Reunion project",
    )

    for i in df.itertuples():

        index = i.index

        iiif_info_url = i.iiif_info_url
        canvas_id = i.iiif_canvas_id
        label = f"{i.name}".strip()
        file_name = i.file_name

        url = i.archive_url

        manifest.make_canvas_from_iiif(
            url=iiif_info_url,
            id=canvas_id,
            anno_page_id=f"{PREFIX}manifest.json/{index}/p1/page",
            anno_id=f"{PREFIX}manifest.json/{index}/p1/page/anno",
            label=label,
            metadata=[
                iiif_prezi3.KeyValueString(
                    label="Title",
                    value={"none": [label]},
                ),
                iiif_prezi3.KeyValueString(
                    label="Filename",
                    value={"none": [file_name]},
                ),
                iiif_prezi3.KeyValueString(
                    label="Web",
                    value={"none": [f'<a href="{url}">{url}</a>']},
                ),
            ],
        )

    return manifest


def get_georeferencing_annotations(
    identifier, iiif_info_url, canvas_id, manifest, annotations_folder, embedded=False
):

    annotation_page_id = f"{PREFIX}annotations/georeferencing/{identifier}.json"

    try:
        r = requests.get(
            "https://annotations.allmaps.org/", params={"url": iiif_info_url}
        )
        r.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(e)
        return

    ap = r.json()

    # Change target from image to Canvas
    for item in ap["items"]:
        item["target"]["source"] = {
            "id": canvas_id,
            "type": "Canvas",
            "partOf": {"id": manifest.id, "type": "Manifest", "label": manifest.label},
        }

    if not embedded:
        ap = {"id": annotation_page_id, **ap}

        with open(
            os.path.join(annotations_folder, f"georeferencing/{identifier}.json"), "w"
        ) as outfile:
            json.dump(ap, outfile, indent=2)

        return iiif_prezi3.Reference(
            id=annotation_page_id,
            label="Georeferencing Annotations made with Allmaps",
            type="AnnotationPage",
        )
    else:
        return ap


def get_navplace_feature(iiif_info_url):

    if iiif_info_url.endswith("/info.json"):
        iiif_info_url = iiif_info_url.replace("/info.json", "")

    allmaps_image_id = hashlib.sha1(iiif_info_url.encode()).hexdigest()[:16]

    try:
        r = requests.get(
            f"https://annotations.allmaps.org/images/{allmaps_image_id}.geojson"
        )
        r.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(e)
        return

    feature_collection = r.json()

    for feature in feature_collection["features"]:
        del feature["properties"]

    return feature_collection


def main(
    selection_filepath="selectie.csv",
    output_filepath="manifest.json",
    annotations_folder="annotations/",
    embedded=False,
):

    df = pd.read_csv(selection_filepath)

    # First, make the manifest
    manifest = make_manifest(df)

    # Then, add georeferencing annotations and save the annotation pages
    for i in df.itertuples():

        identifier = i.index
        iiif_info_url = i.iiif_info_url
        canvas_id = i.iiif_canvas_id

        ap = get_georeferencing_annotations(
            identifier,
            iiif_info_url,
            canvas_id,
            manifest,
            annotations_folder,
            embedded=embedded,
        )

        if ap is None:
            continue

        navPlace = iiif_prezi3.NavPlace(**get_navplace_feature(iiif_info_url))

        for c in manifest.items:
            if c.id == canvas_id:

                if not c.annotations:
                    c.annotations = []

                c.annotations.append(ap)

                c.navPlace = navPlace

    # Edit context
    manifest_jsonld = manifest.jsonld_dict()
    manifest_jsonld["@context"] = [
        "http://iiif.io/api/extension/navplace/context.json",
        "http://iiif.io/api/presentation/3/context.json",
    ]

    # Save the manifest
    with open(output_filepath, "w") as outfile:
        json.dump(manifest_jsonld, outfile, indent=2)


if __name__ == "__main__":

    # One manifest with external (referenced) annotations
    main(
        selection_filepath="data/selection.csv",
        output_filepath="data/manifest.json",
        annotations_folder="data/annotations/",
    )
