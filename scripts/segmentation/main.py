import os
import sys
import uuid
import json
from itertools import count, combinations

import xml.etree.ElementTree as ET
from shapely.geometry import Polygon

import torch
from pycocotools import mask as mask_utils

from sam2.build_sam import build_sam2
from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

import cv2
from PIL import Image
import numpy as np

Image.MAX_IMAGE_PIXELS = None  # Disable DecompressionBombError

MODEL = "./model/sam2.1_hiera_large.pt"  # large model
MODEL_TYPE = "configs/sam2.1/sam2.1_hiera_l.yaml"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Thresholds
IOU = 0.9
STABILITY = 0.8
MIN_AREA_THRESHOLD = 100
MAX_AREA_THRESHOLD = 0.9  # 90% of the image
BORDER_THRESHOLD = 5

ncounter = count()


def getSVG(coordinates):

    points = [f"{int(x)},{int(y)}" for x, y in coordinates + [coordinates[0]]]

    svg = ET.Element("svg", xmlns="http://www.w3.org/2000/svg")
    _ = ET.SubElement(
        svg,
        "polygon",
        points=" ".join(points),
    )

    return ET.tostring(svg, encoding=str)


def get_resized_images(image: Image, window_size: int, resize_factor: int = 2):
    # image_bgr = cv2.imread(image)
    # image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    width, height = image.size

    # height, width, _ = image_bgr.shape

    # Let's make sure the image's size is divisible by the resize factor,
    # then we can easily resize the image and transpose the masks. This works by cropping.
    while height % resize_factor != 0:
        image = image.crop((0, 0, width, height - 1))
        # image_rgb = image_rgb[:-1, :, :]
        height -= 1

    while width % resize_factor != 0:
        image = image.crop((0, 0, width - 1, height))
        # image_rgb = image_rgb[:, :-1, :]
        width -= 1

    # Get a minimum factor to resize the image to the window size
    f_min = min(window_size / width, window_size / height)

    n = 0

    original_width, original_height = width, height

    while width > window_size or height > window_size:

        # if n < 2:
        #     n += 1
        #     continue

        print(f"The image was {width}x{height}, ", end="")

        f = max(f_min, resize_factor**-n)

        # resized_image = cv2.resize(image_rgb, None, fx=f, fy=f)
        resized_image = image.resize(
            (int(original_width * f), int(original_height * f)),
            Image.Resampling.LANCZOS,
        )

        n += 1
        width, height = resized_image.size

        print(f"resizing to {f*100}%: {width}x{height}")
        yield f, resized_image


def get_image_cutouts(image: Image, window_size: int, step_size: int):
    width, height = image.size

    # rolling window
    for y in range(0, height, step_size):
        for x in range(0, width, step_size):
            # cropped_image = image[y : y + window_size, x : x + window_size]

            cropped_image = image.crop((x, y, x + window_size, y + window_size))

            yield x, y, cropped_image


def process_image(
    image: Image,
    canvas_id: str,
    x: int,
    y: int,
    original_image: Image,
    original_width: int,
    original_height: int,
    resize_factor: float,
    mask_generator: SAM2AutomaticMaskGenerator,
    output_folder: str = "",
    output_png: bool = True,
    output_web_annotation: bool = True,
    border_threshold: int = BORDER_THRESHOLD,
    folder_prefix: str = "",
    max_area_threshold: float = MAX_AREA_THRESHOLD,
):

    f_i = 1 / resize_factor

    width, height = image.size
    # image_rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)

    data = {
        "x": int(x * f_i),
        "y": int(y * f_i),
        "f": resize_factor,
        "width": int(width * f_i),
        "height": int(height * f_i),
        "results": [],
        "annotations": [],
    }

    # start at 0
    width -= 1
    height -= 1

    print(f"Processing cutout {data['x']}x{data['y']}")

    # index_count = next(ncounter)

    # original image crop
    original_image_crop = original_image.crop(
        (data["x"], data["y"], data["x"] + data["width"], data["y"] + data["height"])
    )
    original_image_crop_rgba = original_image_crop.convert("RGBA")

    # image.save(os.path.join(output_folder, f"{folder_prefix}_{index_count}.png"))
    # original_image_crop_rgba.save(
    #     os.path.join(output_folder, f"{folder_prefix}_{index_count}_original.png")
    # )

    results = mask_generator.generate(np.array(image))

    for r in results:

        del r["crop_box"]

        r["uuid"] = str(uuid.uuid4())

        # bbox coords
        r_x1, r_y1, r_w, r_h = r["bbox"]

        r_x1 = int(r_x1)
        r_x2 = r_x1 + int(r_w)
        r_y1 = int(r_y1)
        r_y2 = r_y1 + int(r_h)

        # if (  # Check if the object is too close to the border of the cutout
        #     r_x1 <= border_threshold
        #     or r_y1 <= border_threshold
        #     or r_x2 >= width - border_threshold
        #     or r_y2 >= height - border_threshold
        # ) and not (  # it's fine if it's close to the border of the original image
        #     r_x1 + x == 0
        #     or r_y1 + y == 0
        #     or r_x2 + x == original_width
        #     or r_y2 + y == original_height
        # ):

        if (  # Check if the object is too close to the border of the cutout
            r_x1 <= border_threshold
            or r_y1 <= border_threshold
            or r_x2 >= width - border_threshold
            or r_y2 >= height - border_threshold
        ):
            continue

        # Only keep the mask for the bbox
        m = mask_utils.decode(r["segmentation"])
        # m = m[r_y1:r_y2, r_x1:r_x2]

        # Check max area threshold of mask
        if m.sum() >= max_area_threshold * width * height:
            continue

        # # Transform according to the resize factor
        # m = cv2.resize(m, None, fx=f_i, fy=f_i)
        m = Image.fromarray(m, "L").resize(
            (int((width + 1) * f_i), int((height + 1) * f_i)), Image.Resampling.LANCZOS
        )

        # Transform the coordinates to the original image's size
        r["bbox"] = [  # bbox
            int(r_x1 * f_i),
            int(r_y1 * f_i),
            int(r_w * f_i),
            int(r_h * f_i),
        ]

        r["point_coords"] = [  # points
            [
                int((r[0] + x) * f_i),
                int((r[1] + y) * f_i),
            ]
            for r in r["point_coords"]
        ]

        # # m = mask_utils.decode(r["segmentation"])
        # m_height, m_width = m.shape
        # m_height, m_width = m.size

        # # Transform the cutout mask to the original image's size
        # mask = np.zeros((original_height, original_width), dtype=np.uint8)
        # mask[y : y + m_height, x : x + m_width] = m

        m_encoded = mask_utils.encode(np.asfortranarray(m))
        m_encoded["counts"] = m_encoded["counts"].decode("utf-8")
        r["segmentation"] = m_encoded

        data["results"].append(r)

        if output_folder:

            mask = mask_utils.decode(r["segmentation"])

            if output_png:

                output_folder_prefix = os.path.join(output_folder, folder_prefix)
                os.makedirs(output_folder_prefix, exist_ok=True)

                # cv2
                # image_rgba = np.array(image.convert("RGBA"))

                # masked_image = cv2.bitwise_and(image_rgba, image_rgba, mask=mask)
                # masked_image[:, :, 3] = mask * 255  # alpha channel

                # cutout = masked_image[r_y1:r_y2, r_x1:r_x2]  # bbox
                # cutout = cv2.cvtColor(cutout, cv2.COLOR_BGR2RGBA)

                # cv2.imwrite(os.path.join(output_folder_prefix, f"{r['uuid']}.png"))", cutout)

                ## PIL
                masked_image_array = np.array(original_image_crop_rgba)

                masked_image_array[:, :, 3] = mask * 255  # alpha channel
                masked_image = Image.fromarray(masked_image_array, "RGBA")

                r_x1, r_y1, r_w, r_h = r["bbox"]

                r_x1 = int(r_x1)
                r_x2 = r_x1 + int(r_w)
                r_y1 = int(r_y1)
                r_y2 = r_y1 + int(r_h)

                cutout = masked_image.crop((r_x1, r_y1, r_x2, r_y2))  # bbox

                cutout.save(os.path.join(output_folder_prefix, f"{r['uuid']}.png"))

            if output_web_annotation:

                contours, _ = cv2.findContours(
                    mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE
                )

                # smooth
                contours = [
                    cv2.approxPolyDP(contour, 0.01, closed=True) for contour in contours
                ]

                # get the largest contour
                contour = max(contours, key=cv2.contourArea)

                points = contour.squeeze().tolist()

                # correct for offset
                points = [[x + data["x"], y + data["y"]] for x, y in points]

                # convert the contour to svg polygon
                svg = getSVG(points)

                annotation = {
                    "@context": "http://www.w3.org/ns/anno.jsonld",
                    "id": r["uuid"],
                    "type": "Annotation",
                    "motivation": "segmenting",
                    "body": [],
                    "target": {
                        "source": canvas_id,
                        "selector": {
                            "type": "SvgSelector",
                            "value": svg,
                        },
                        "generator": {
                            "id": "segmentanything",
                            "type": "Software",
                        },
                    },
                }

                data["annotations"].append(annotation)

    return data


def svg_to_polygon(svg: str) -> Polygon:
    tree = ET.fromstring(svg)

    namespace = {"svg": "http://www.w3.org/2000/svg"}

    # Find the polygon element
    polygon_element = tree.find(".//svg:polygon", namespaces=namespace)
    if polygon_element is None:
        raise ValueError(f"No polygon found in {svg}")

    # Extract the points attribute
    points = polygon_element.attrib["points"].strip()

    # Convert points to a list of tuples (x, y)
    points_list = [tuple(map(float, point.split(","))) for point in points.split()]

    # Create and return a Shapely Polygon
    return Polygon(points_list)


def calculate_iou(shape1, shape2):

    intersection_area = shape1.intersection(shape2).area
    union_area = shape1.union(shape2).area

    return intersection_area / union_area


def filter_cutouts(data: dict, output_folder: str = ""):

    to_delete = set()
    annotations = []
    annotations_detail_id = []

    for cutout in data["cutouts"]:

        f = cutout["f"]

        for annotation in cutout["annotations"]:

            uuid = annotation["id"]
            svg = annotation["target"]["selector"]["value"]

            shape = svg_to_polygon(svg)

            annotations.append(annotation)
            annotations_detail_id.append((shape, f, uuid))

    anno_combinations = combinations(annotations_detail_id, 2)

    for n, ((shape1, f1, id1), (shape2, f2, id2)) in enumerate(anno_combinations, 1):

        if n % 100 == 0:
            print(f"Processing {n} combinations", end="\r")

        intersection = shape1.intersection(shape2)
        union = shape1.union(shape2)

        iou = intersection.area / union.area

        if iou > 0.7:
            if f1 <= f2:
                to_delete.add(id2)
            else:
                to_delete.add(id1)

        # Make a decision based on the intersection over union. Keep all annotations that are not similar

    filtered_annotations = [
        annotation for annotation in annotations if annotation["id"] not in to_delete
    ]

    print(
        f"\nDeleted {len(to_delete)}/{len(annotations)} annotations. Remaining: {len(filtered_annotations)}."
    )

    with open(os.path.join(output_folder, "filtered_annotations.json"), "w") as f:
        json.dump(filtered_annotations, f, indent=4)


def main(
    images: list,
    output_folder: str,
    window_size: int = 1000,  # to take VRAM into account
    step_size: int = 750,
    model: str = MODEL,
    model_type: str = MODEL_TYPE,
    device: str = DEVICE,
    iou: float = IOU,
    stability: float = STABILITY,
    min_area_threshold: int = MIN_AREA_THRESHOLD,
    max_area_threshold: float = MAX_AREA_THRESHOLD,
):
    # sam = sam_model_registry[model_type](checkpoint=model)
    # sam.to(device=device)

    sam2 = build_sam2(
        model_type,
        model,
        device=device,
        apply_postprocessing=True,
    )

    # mask_generator = SamAutomaticMaskGenerator(
    #     sam,
    #     pred_iou_thresh=iou,
    #     stability_score_thresh=stability,
    #     min_mask_region_area=area_threshold,
    #     output_mode="coco_rle",
    # )

    mask_generator = SAM2AutomaticMaskGenerator(
        sam2,
        pred_iou_thresh=iou,
        stability_score_thresh=stability,
        min_mask_region_area=min_area_threshold,
        output_mode="coco_rle",
    )

    for image_path in images:
        image_name = os.path.basename(image_path)
        image_name_without_extension = os.path.splitext(image_name)[0]

        canvas_id = f"canvas:{image_name_without_extension}"

        image_output_folder = os.path.join(output_folder, image_name_without_extension)
        os.makedirs(image_output_folder, exist_ok=True)

        # height, width, _ = cv2.imread(image_path).shape
        image = Image.open(image_path)
        width, height = image.size

        data = {
            "image": image_name,
            "height": height,
            "width": width,
            "cutouts": [],
        }

        resized_images = get_resized_images(image, window_size)

        for f, resized_image in resized_images:

            # n_temp = 0

            for x, y, cutout in get_image_cutouts(
                resized_image, window_size, step_size
            ):

                # n_temp += 1

                result = process_image(
                    cutout,
                    canvas_id,
                    x=x,
                    y=y,
                    original_image=image,
                    original_height=height,
                    original_width=width,
                    resize_factor=f,
                    mask_generator=mask_generator,
                    output_folder=image_output_folder,
                    folder_prefix=f'{"%.4f" % f}',
                    max_area_threshold=max_area_threshold,
                )

                data["cutouts"].append(result)

                # if n_temp > 2:
                #     break

        with open(
            os.path.join(image_output_folder, f"{image_name_without_extension}.json"),
            "w",
        ) as outfile:
            json.dump(data, outfile, indent=1)

        # TODO: deduplicate results (due to overlapping windows)
        # TODO: merge or cluster overlapping results (IOU)


if __name__ == "__main__":
    # OUTPUT_FOLDER = "./results"
    # EXAMPLE = "./example/7beaf613-68bf-4070-b79b-bb5c9282edcd.jpg"
    # images = [EXAMPLE]

    if len(sys.argv) < 3:
        print("Usage: python main.py <image_folder> <output_folder>")
        sys.exit(1)

    IMAGE_FOLDER = sys.argv[1]
    OUTPUT_FOLDER = sys.argv[2]

    images = [
        os.path.join(IMAGE_FOLDER, image)
        for image in os.listdir(IMAGE_FOLDER)
        if image.endswith(".jpg")
    ]

    main(images, output_folder=OUTPUT_FOLDER)
