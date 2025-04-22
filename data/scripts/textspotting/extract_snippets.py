import os
import sys
import json

from svgpathtools import svgstr2paths
from PIL import Image

import cv2
import numpy as np

Image.MAX_IMAGE_PIXELS = None  # Disable DecompressionBombError

MINIMUM_WIDTH = 35
MINIMUM_HEIGHT = 25


def parse_annotation_page(annotation_page):

    annotation2svg = dict()

    for annotation in annotation_page.get("items", []):
        if annotation["type"] == "Annotation":
            annotation_id = annotation["id"]

            svg = annotation["target"]["selector"]["value"]

            annotation2svg[annotation_id] = svg

    return annotation2svg


def extract_snippets(
    image_file_path: str, annotation_page_path: str, output_folder: str
):

    image_name_without_extension = os.path.splitext(os.path.basename(image_file_path))[
        0
    ]

    # Load the image
    image = Image.open(image_file_path)
    # image = cv2.imread(f"/media/leon/HDE0069/GLOBALISE/maps/download/{image_uuid}.jpg")

    # Load the annotations
    with open(annotation_page_path, "r") as f:
        annotation_page = json.load(f)
        annotations = annotation_page["items"]

    snippets_image_folder = os.path.join(output_folder, image_name_without_extension)
    os.makedirs(snippets_image_folder, exist_ok=True)

    snippets = []

    print(f"Extracting snippets from {image_name_without_extension}")
    for annotation in annotations:

        annotation_id = annotation["id"]
        svg = annotation["target"]["selector"]["value"]

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
        snippet_path = os.path.join("/data/", f"{annotation_id}.png")  # for Loghi
        square.save(snippet_path)
        snippets.append(snippet_path)

    with open(f"{snippets_image_folder}/lines.txt", "w") as f:
        f.write("\n".join(snippets))


if __name__ == "__main__":

    # IMAGE_FOLDER = "/home/leon/Documents/GLOBALISE/necessary-reunions/data/images"
    # AP_FOLDER = (
    #     "/home/leon/Documents/GLOBALISE/necessary-reunions/scripts/textspotting/results"
    # )
    # SNIPPET_FOLDER = "/home/leon/Documents/GLOBALISE/necessary-reunions/scripts/textspotting/snippets"

    if len(sys.argv) != 4:
        print(
            "Usage: python extract_snippets.py <image_folder> <ap_folder> <snippet_folder>"
        )
        sys.exit(1)

    IMAGE_FOLDER = sys.argv[1]
    AP_FOLDER = sys.argv[2]
    SNIPPET_FOLDER = sys.argv[3]

    for image in os.listdir(IMAGE_FOLDER):

        image_file_path = os.path.join(IMAGE_FOLDER, image)

        image_name_without_extension = os.path.splitext(image)[0]
        canvas_id = f"canvas:{image_name_without_extension}"

        annotation_page_file_path = os.path.join(
            AP_FOLDER, f"{image_name_without_extension}.json"
        )

        if not os.path.exists(annotation_page_file_path):
            print(f"Annotation page not found for {image_file_path}")
            continue

        extract_snippets(image_file_path, annotation_page_file_path, SNIPPET_FOLDER)
