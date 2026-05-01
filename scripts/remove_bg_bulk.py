#!/usr/bin/env python3
"""
Bulk background removal para todas las imágenes de public/images/
Guarda PNGs sin fondo en public/images-nobg/
"""

import os
import sys
from pathlib import Path
from rembg import remove, new_session
from PIL import Image
import io

BASE = Path(__file__).parent.parent
SRC  = BASE / "public" / "images"
DEST = BASE / "public" / "images-nobg"

DEST.mkdir(exist_ok=True)

images = sorted([f for f in SRC.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png")])
total  = len(images)

print(f"Procesando {total} imágenes con rembg...")
print(f"  origen:  {SRC}")
print(f"  destino: {DEST}\n")

# Cargamos el modelo una sola vez (más rápido en batch)
session = new_session("u2net")

ok = 0
errors = []

for i, src_path in enumerate(images, 1):
    stem = src_path.stem
    dest_path = DEST / f"{stem}.png"

    if dest_path.exists():
        print(f"  [{i:02d}/{total}] {src_path.name} → ya existe, saltando")
        ok += 1
        continue

    try:
        with open(src_path, "rb") as f:
            data = f.read()

        result = remove(data, session=session)

        # Autocrop: recortar al bounding box del contenido opaco
        img = Image.open(io.BytesIO(result)).convert("RGBA")
        bbox = img.split()[3].getbbox()   # bounding box del canal alpha
        if bbox:
            img = img.crop(bbox)
        img.save(dest_path, "PNG")

        print(f"  [{i:02d}/{total}] {src_path.name} → {dest_path.name} ✓")
        ok += 1
    except Exception as e:
        print(f"  [{i:02d}/{total}] {src_path.name} → ERROR: {e}", file=sys.stderr)
        errors.append(src_path.name)

print(f"\nListo: {ok}/{total} procesadas", end="")
if errors:
    print(f", {len(errors)} errores: {', '.join(errors)}")
else:
    print(" sin errores ✓")
