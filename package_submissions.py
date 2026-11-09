import os
import zipfile
import shutil

project_root = r"C:\Users\boyap\.gemini\antigravity\scratch\kirana-order"
downloads_dir = r"C:\Users\boyap\Downloads"
artifact_dir = r"C:\Users\boyap\.gemini\antigravity\brain\238415da-5fb0-4d3d-b270-459e06750f44"

# 1. Package kirana-docs-submission.zip
docs_files = [
    "TECHNICAL_DESIGN_DOCUMENT.docx",
    "TECHNICAL_DESIGN_DOCUMENT.md",
    "deployment.md",
    "ASSUMPTIONS.md",
    "PRODUCTION_READINESS.md",
    "README.md"
]

docs_zip_downloads = os.path.join(downloads_dir, "kirana-docs-submission.zip")
docs_zip_artifact = os.path.join(artifact_dir, "kirana-docs-submission.zip")

print("Building kirana-docs-submission.zip...")
with zipfile.ZipFile(docs_zip_downloads, "w", zipfile.ZIP_DEFLATED) as zf:
    for f in docs_files:
        src = os.path.join(project_root, f)
        if os.path.exists(src):
            zf.write(src, arcname=f)
            print(f"Added {f}")
        else:
            print(f"Warning: {f} not found!")

shutil.copy2(docs_zip_downloads, docs_zip_artifact)
print(f"Saved {docs_zip_downloads} and copied to {docs_zip_artifact}")

# 2. Package kirana-order-submission.zip
# Standard root package shape with strict exclusion of .env secrets, node_modules, and git directories
code_zip_downloads = os.path.join(downloads_dir, "kirana-order-submission.zip")
code_zip_artifact = os.path.join(artifact_dir, "kirana-order-submission.zip")

excluded_dirs = {"node_modules", ".git", "dist", ".vite", ".turbo", ".system_generated"}
excluded_extensions = {".log", ".zip"}

print("Building kirana-order-submission.zip...")
count = 0
with zipfile.ZipFile(code_zip_downloads, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(project_root):
        dirs[:] = [d for d in dirs if d not in excluded_dirs]
        for file in files:
            # Strictly exclude sensitive .env files, keeping only .env.example
            if file == ".env" or (file.startswith(".env.") and not file.endswith(".example")):
                continue
            ext = os.path.splitext(file)[1].lower()
            if ext in excluded_extensions:
                continue
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, project_root)
            # Store directly from repository root
            zf.write(abs_path, arcname=rel_path)
            count += 1

shutil.copy2(code_zip_downloads, code_zip_artifact)
print(f"Packaged {count} files directly into {code_zip_downloads} and {code_zip_artifact}")
