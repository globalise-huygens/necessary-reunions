#!/usr/bin/env python3
import csv
import sys

def add_ids_to_csv(input_file, output_file):
    """Add a new ID column to CSV file while preserving the existing Index page column"""

    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        rows = list(reader)

    if not rows:
        print("No data found in CSV")
        return

    # Process header - add "id" as the first column
    header = rows[0]
    new_header = ['id'] + header

    # Process data lines
    updated_rows = [new_header]

    for i, row in enumerate(rows[1:], 1):  # Start from 1 for data rows
        # Add sequential ID as the first column, keep all other columns
        new_row = [str(i)] + row
        updated_rows.append(new_row)

    # Write the updated content
    with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(updated_rows)

    print(f"Successfully added ID column to {len(updated_rows)-1} rows")
    print(f"Output written to: {output_file}")

if __name__ == "__main__":
    input_file = "/Users/neru/projects/necessary-reunions/public/gavoc-atlas-index.csv"
    output_file = "/Users/neru/projects/necessary-reunions/public/gavoc-atlas-index-new.csv"

    add_ids_to_csv(input_file, output_file)
