"""
Download images using dezoomify-rs.
For more information, visit: https://github.com/lovasoa/dezoomify-rs
"""

import os
import pandas as pd


def download_images(
    csv_file, output_dir, name_column="file_name", url_column="iiif_info_url"
):

    df = pd.read_csv(csv_file)

    for name, url in zip(df[name_column], df[url_column]):

        target_file_path = os.path.join(output_dir, name)

        print(f"Downloading {name} from {url} to {target_file_path}")
        os.system(
            f'dezoomify-rs --dezoomer iiif --largest "{url}" "{target_file_path}".jpg --compression 0'
        )


if __name__ == "__main__":

    csv_file = "data/selection.csv"
    output_dir = "data/images"
    name_column = "file_name"
    url_column = "iiif_info_url"

    # Create the output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    download_images(csv_file, output_dir, name_column, url_column)
