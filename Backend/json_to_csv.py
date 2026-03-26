import os
import json
import csv

def load_json_file(filename):
    """
    Load JSON content from a file. Returns None if file is missing or contains invalid JSON.
    """
    if not os.path.exists(filename):
        print(f"Warning: {filename} not found.")
        return None
    with open(filename, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception as e:
            print(f"Error parsing {filename}: {e}")
            return None

def json_to_csv(json_data, csv_filename):
    """
    Converts JSON data to a CSV file based on specific flattening rules.
    """
    if json_data is None:
        return

    # Case 1: JSON is a list of objects (dicts) or a single object
    if isinstance(json_data, dict):
        json_data = [json_data]

    if isinstance(json_data, list) and json_data and isinstance(json_data[0], dict):
        # Collect all keys across all objects to ensure complete headers
        fieldnames = set()
        for item in json_data:
            if isinstance(item, dict):
                fieldnames.update(item.keys())
        fieldnames = sorted(list(fieldnames))

        with open(csv_filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for item in json_data:
                if isinstance(item, dict):
                    # Fill missing keys with empty string
                    row = {k: item.get(k, "") for k in fieldnames}
                    writer.writerow(row)
                else:
                    # Fallback for unexpected mixed list: dump as 'value'
                    pass # This case is partially handled by the outer logic
    
    # Case 2: JSON is anything else (list of scalars, string, number, etc.)
    else:
        with open(csv_filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["value"])
            if isinstance(json_data, list):
                for item in json_data:
                    writer.writerow([json.dumps(item)])
            else:
                writer.writerow([json.dumps(json_data)])

def main():
    output_dir = "csv_output"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")

    # Scan the current directory for all .txt files
    files_processed = 0
    for fname in os.listdir("."):
        if fname.endswith(".txt"):
            json_data = load_json_file(fname)
            if json_data is not None:
                base = os.path.splitext(fname)[0]
                csv_name = os.path.join(output_dir, f"{base}_raw.csv")
                print(f"Converting {fname} -> {csv_name}")
                json_to_csv(json_data, csv_name)
                files_processed += 1
    
    if files_processed == 0:
        print("No .txt files found to convert.")
    else:
        print(f"Finished. Converted {files_processed} files into '{output_dir}/'.")

if __name__ == "__main__":
    main()
