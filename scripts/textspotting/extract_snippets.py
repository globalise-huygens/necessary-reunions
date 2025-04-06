import os
import json
import requests

from svgpathtools import svgstr2paths
from PIL import Image

import cv2
import numpy as np

Image.MAX_IMAGE_PIXELS = None  # Disable DecompressionBombError

MINIMUM_WIDTH = 35
MINIMUM_HEIGHT = 25
# import pytesseract


def parse_annotation_page(annotation_page):

    annotation2svg = dict()

    for annotation in annotation_page.get("items", []):
        if annotation["type"] == "Annotation":
            annotation_id = annotation["id"]

            svg = annotation["target"]["selector"]["value"]

            annotation2svg[annotation_id] = svg

    return annotation2svg


def extract_snippets(image_uuid, annotations, folder="snippets"):

    image = Image.open(os.path.join(IMAGE_FOLDER, f"{image_uuid}.jpg"))
    # image = cv2.imread(f"/media/leon/HDE0069/GLOBALISE/maps/download/{image_uuid}.jpg")

    snippets_image_folder = os.path.join(folder, image_uuid)
    os.makedirs(snippets_image_folder, exist_ok=True)

    snippets = []

    print(f"Extracting snippets from {image_uuid}...")

    for annotation_id, svg in annotations.items():

        paths = svgstr2paths(svg)[0][0]
        coords = [(int(i[0].real), int(i[0].imag)) for i in paths]

        if len(coords) < 3:  # not a polygon
            continue

        # Find minimum bounding box (rotated rectangle)
        (center, (width, height), angle) = cv2.minAreaRect(np.array(coords))

        # Check if the box is too small
        if width < MINIMUM_WIDTH or height < MINIMUM_HEIGHT:
            continue

        box = cv2.boxPoints((center, (width, height), angle))

        # Rotate the image and the box
        if width < height:
            M = cv2.getRotationMatrix2D(center, angle - 90, 1.0)
            rotated_box = cv2.transform(np.array([box]), M)[0]

            image_rotated = image.rotate(angle - 90, center=center)
        else:
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated_box = cv2.transform(np.array([box]), M)[0]

            image_rotated = image.rotate(angle, center=center)

        rotated_box = np.intp(rotated_box)

        # Crop the image
        x, y, w, h = cv2.boundingRect(rotated_box)
        square = image_rotated.crop((x, y, x + w, y + h))

        # Save
        # cv2.imwrite(f"snippets/{annotation_id}.png", image)
        snippet_path = os.path.join(snippets_image_folder, f"{annotation_id}.png")
        square.save(snippet_path)
        snippets.append(snippet_path)

    with open(f"{snippets_image_folder}/lines.txt", "w") as f:
        f.write("\n".join(snippets))


if __name__ == "__main__":

    IMAGE_FOLDER = "/media/leon/HDE0069/GLOBALISE/maps/download/"
    SNIPPET_FOLDER = "snippets"

    for uri in [
        "https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/A.json",
        "https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/B.json",
        "https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/C.json",
    ]:
        canvasses = parse_iiif_prezi(uri)

        # with open("canvasses.json", "w") as f:
        #     json.dump(canvasses, f, indent=2)

        # extract_snippets("f0e37c5f-2c27-4ebc-99bf-705643a8af13", None)

        # with open("canvasses.json", "r") as f:
        #     canvasses = json.load(f)

        for canvas in canvasses:
            image_uuid = canvas["image_uuid"]
            annotations = canvas.get("annotations", {})

            if annotations:
                extract_snippets(image_uuid, annotations, SNIPPET_FOLDER)
