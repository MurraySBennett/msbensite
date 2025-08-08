import os
import hashlib
import re

def create_hash(file_path):
    """Generates a short MD5 hash based on the file's content."""
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()[:8]  # Using a short hash for readability

def version_assets(directory_path, file_types_to_version):
    """
    Goes through a directory, renames specified files with a content hash,
    and updates all references in HTML files.
    
    Args:
        directory_path (str): The root directory to scan (e.g., 'frontend').
        file_types_to_version (list): List of file extensions to version (e.g., ['.css', '.js']).
    """
    renamed_files = {}

    print(f"Starting asset versioning in '{directory_path}'...")

    # Step 1: Rename files and store the old/new name mapping
    for root, _, files in os.walk(directory_path):
        for filename in files:
            file_extension = os.path.splitext(filename)[1].lower()
            if file_extension in file_types_to_version:
                file_path = os.path.join(root, filename)
                file_hash = create_hash(file_path)
                
                # Create the new filename with the hash
                base_name = os.path.splitext(filename)[0]
                new_filename = f"{base_name}.{file_hash}{file_extension}"
                new_file_path = os.path.join(root, new_filename)
                
                print(f"  Renaming: {filename} -> {new_filename}")
                os.rename(file_path, new_file_path)
                
                # Store the mapping from old to new name
                renamed_files[filename] = new_filename

    # Step 2: Update references in HTML files
    print("\nUpdating HTML files with new asset names...")
    for root, _, files in os.walk(directory_path):
        for filename in files:
            if filename.endswith('.html'):
                html_path = os.path.join(root, filename)
                print(f"  Processing HTML file: {filename}")
                
                with open(html_path, 'r') as f:
                    content = f.read()
                
                new_content = content
                for old_name, new_name in renamed_files.items():
                    # Use a regex to find links and script tags
                    # This will replace things like `href="style.css"` with `href="style.a8f2e7b1.css"`
                    pattern = re.compile(f'([src|href]=["\'])(?<!\?){old_name}(?=["\'])', re.IGNORECASE)
                    new_content = pattern.sub(f'\\1{new_name}', new_content)
                
                if new_content != content:
                    with open(html_path, 'w') as f:
                        f.write(new_content)
                    print(f"    - Updated references in {filename}")
                else:
                    print(f"    - No references to update in {filename}")
    
    print("\nAsset versioning complete!")

if __name__ == '__main__':
    # Define the directory to process and the file types to version
    TARGET_DIR = 'frontend'
    FILE_TYPES = ['.js', '.css', '.png', '.jpg', '.jpeg', 'JPG', '.gif', '.svg', '.json']
    
    # Check if the directory exists before running
    if os.path.isdir(TARGET_DIR):
        version_assets(TARGET_DIR, FILE_TYPES)
    else:
        print(f"Error: Directory '{TARGET_DIR}' not found. Please check the path.")

