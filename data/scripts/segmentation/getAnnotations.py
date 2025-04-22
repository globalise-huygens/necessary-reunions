import json
import xml.etree.ElementTree as ET

from itertools import combinations

from shapely.geometry import Polygon


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


with open("7beaf613-68bf-4070-b79b-bb5c9282edcd.json") as f:
    data = json.load(f)

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

with open("7beaf613-68bf-4070-b79b-bb5c9282edcd_annotations.json", "w") as f:
    json.dump(filtered_annotations, f, indent=4)
