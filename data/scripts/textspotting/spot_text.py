import os
import sys
import json
import uuid
from lxml import etree

from mapreader import loader
from mapreader import MapTextRunner

# paths to our config and weights files for the text spotting model
cfg_file = "./MapTextPipeline/configs/ViTAEv2_S/rumsey/final_rumsey.yaml"
weights_file = "./rumsey-finetune.pth"

from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def recognize_text(image_path: str):
    map_loader = loader(image_path)
    map_loader.patchify_all(method="pixel", patch_size=1024, overlap=0.1)

    parent_df, patch_df = map_loader.convert_images()

    map_text_runner = MapTextRunner(
        patch_df,
        parent_df,
        cfg_file=cfg_file,
        weights_file=weights_file,
    )

    map_text_runner.run_all()

    predictions_df = map_text_runner.convert_to_parent_pixel_bounds(
        return_dataframe=True
    )

    return predictions_df


def getSVG(polygon):

    coordinates = list(polygon.exterior.coords)

    points = [f"{int(x)},{int(y)}" for x, y in coordinates + [coordinates[0]]]

    svg = etree.Element("svg", xmlns="http://www.w3.org/2000/svg")
    _ = etree.SubElement(
        svg,
        "polygon",
        points=" ".join(points),
    )

    return etree.tostring(svg, encoding=str)


def convert_to_annotations(predictions_df, canvas_id: str):

    items = []
    for i in predictions_df.itertuples():

        svg_selector = getSVG(i.geometry)

        # text = i.text
        # score = i.score

        body = [
            {
                "type": "TextualBody",
                "value": i.text,
                "format": "text/plain",
                "purpose": "supplementing",
                "generator": {
                    "id": "https://github.com/maps-as-data/MapTextPipeline",
                    "type": "Software",
                },
            }
        ]

        target = {
            # "id": ???,
            "source": canvas_id,
            "selector": {"type": "SvgSelector", "value": svg_selector},
            "generator": {
                "id": "https://github.com/maps-as-data/MapTextPipeline",
                "type": "Software",
            },
        }

        annotation = {
            "@context": "http://www.w3.org/ns/anno.jsonld",
            "id": str(uuid.uuid4()),
            "type": "Annotation",
            "motivation": "textspotting",
            "body": body,
            "target": target,
        }

        items.append(annotation)

    annotationPage = {
        "@context": "http://iiif.io/api/presentation/3/context.json",
        "type": "AnnotationPage",
        "items": items,
    }

    return annotationPage


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python recognize_text.py <image_path>")
        sys.exit(1)

    image_path = str(sys.argv[1])
    image_name = os.path.splitext(os.path.basename(image_path))[0]

    canvas_id = "canvas:" + image_name

    predictions_df = recognize_text(image_path)
    annotationPage = convert_to_annotations(predictions_df, canvas_id)

    with open(f"results/{image_name}.json", "w") as f:
        json.dump(annotationPage, f, indent=2)
