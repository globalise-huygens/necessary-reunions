import os
import json
import pandas as pd


def main(snippets_folder: str, annotation_page_folder: str):

    for image_name in os.listdir(snippets_folder):

        annotation_page_path = os.path.join(
            annotation_page_folder, image_name + ".json"
        )
        with open(annotation_page_path, "r") as f:
            annotation_page = json.load(f)

        results_file_path = os.path.join(snippets_folder, image_name, "results.tsv")
        df = pd.read_csv(
            results_file_path, sep="\t", header=None, names=["id", "confidence", "text"]
        )

        df["id"] = [i.rsplit("/", 1)[-1].replace(".png", "") for i in df["id"]]

        #                                        id  confidence     text
        #      0e180836-48e5-4f7a-ab5a-fb4d518cd924    0.991326    Copie

        annotations = []
        for annotation in annotation_page["items"]:
            annotation_id = annotation["id"]

            result = df.loc[df["id"] == annotation_id, ["confidence", "text"]].values

            if len(result) == 0:
                continue
            else:
                confidence, text = result[0]

            if pd.isna(text):
                continue

            print(
                f"Annotation ID: {annotation_id}, Confidence: {confidence}, Text: {text}"
            )

            body = {
                "type": "TextualBody",
                "value": text.strip(),
                "format": "text/plain",
                "purpose": "supplementing",
                "generator": {
                    "id": "https://hdl.handle.net/10622/X2JZYY",
                    "type": "Software",
                    "label": "GLOBALISE Loghi Handwritten Text Recognition Model - August 2023",
                },
            }

            annotation["body"].append(body)
            annotations.append(annotation)

        # update annotations
        annotation_page["items"] = annotations

        print(f"Writing {image_name} annotation page")
        with open(annotation_page_path, "w") as f:
            json.dump(annotation_page, f, indent=2)


if __name__ == "__main__":
    SNIPPETSFOLDER = "/home/leon/Documents/GLOBALISE/necessary-reunions/scripts/textspotting/snippets"

    ANNOTATION_PAGE_FOLDER = (
        "/home/leon/Documents/GLOBALISE/necessary-reunions/scripts/textspotting/results"
    )

    main(SNIPPETSFOLDER, ANNOTATION_PAGE_FOLDER)
