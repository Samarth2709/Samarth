import argparse
import os
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def find_monospaced_font(explicit_path: Optional[str] = None, size: int = 12) -> ImageFont.FreeTypeFont:
    """
    Attempt to load a good monospaced font. Prefer system fonts on macOS.
    Falls back to PIL's default bitmap font if no TTF found.
    """
    if explicit_path:
        # Try the explicit path directly, and for .ttc also try index 0..3
        font_path = Path(explicit_path)
        if font_path.suffix.lower() == ".ttc":
            last_err = None
            for idx in range(4):
                try:
                    return ImageFont.truetype(str(font_path), size=size, index=idx)
                except Exception as e:  # noqa: BLE001
                    last_err = e
                    continue
            # If all indices failed, raise last error
            raise RuntimeError(f"Failed to load TTC font at {font_path}: {last_err}")
        else:
            return ImageFont.truetype(str(font_path), size=size)

    candidate_paths: List[Tuple[str, Optional[int]]] = [
        ("/System/Library/Fonts/Menlo.ttc", 0),
        ("/System/Library/Fonts/Menlo.ttc", 1),
        ("/Library/Fonts/Menlo.ttc", 0),
        ("/Library/Fonts/Menlo.ttc", 1),
        ("/Library/Fonts/Courier New.ttf", None),
        ("/System/Library/Fonts/Courier.dfont", None),
        ("/System/Library/Fonts/SFNSMono.ttf", None),
        ("/System/Library/Fonts/SFNSMono.ttf/..", None),  # guard for potential path variations
    ]

    for path, idx in candidate_paths:
        try:
            if path.lower().endswith(".ttc"):
                # Collection font with index
                return ImageFont.truetype(path, size=size, index=(idx or 0))
            return ImageFont.truetype(path, size=size)
        except Exception:  # noqa: BLE001
            continue

    # Fallback
    return ImageFont.load_default()


def measure_font_cell(font: ImageFont.ImageFont) -> Tuple[int, int]:
    """Return the width and height of a single monospaced cell in pixels."""
    try:
        ascent, descent = font.getmetrics()
        height = ascent + descent
    except Exception:  # noqa: BLE001
        # Reasonable default
        height = int(font.size * 1.3) if getattr(font, "size", None) else 12

    # Use a wide glyph to approximate advance width
    try:
        width = int(round(font.getlength("M")))
        width = max(width, 1)
    except Exception:  # noqa: BLE001
        # Fallback: width ~= 0.6 * height typical for mono fonts
        width = max(int(round(height * 0.6)), 1)

    return width, height


def build_density_sorted_charset(font: ImageFont.ImageFont, charset: str) -> List[str]:
    """
    Render each character and compute its ink density (darker = more ink).
    Return characters sorted by increasing brightness (lightest first).
    """
    cell_w, cell_h = measure_font_cell(font)
    densities: List[Tuple[float, str]] = []

    for ch in charset:
        # Render on white background, black text
        tile = Image.new("L", (cell_w, cell_h), color=255)
        draw = ImageDraw.Draw(tile)
        # Center text within the cell
        try:
            bbox = font.getbbox(ch)
            ch_w = bbox[2] - bbox[0]
            ch_h = bbox[3] - bbox[1]
        except Exception:  # noqa: BLE001
            # Fallback approximate
            ch_w, ch_h = int(cell_w * 0.6), int(cell_h * 0.8)

        x = max((cell_w - ch_w) // 2, 0)
        y = max((cell_h - ch_h) // 2, 0)
        draw.text((x, y), ch, fill=0, font=font)

        arr = np.asarray(tile, dtype=np.float32)
        # Convert to ink density [0..1], where 1 means full black
        ink = 1.0 - (arr / 255.0)
        density = float(ink.mean())
        densities.append((density, ch))

    # Sort from lightest to darkest (increasing density)
    densities.sort(key=lambda t: t[0])
    return [ch for _, ch in densities]


def image_to_ascii_image(
    image: Image.Image,
    font: ImageFont.ImageFont,
    charset_sorted: List[str],
    scale: float = 2.0,
    invert: bool = False,
    gamma: float = 1.0,
) -> Image.Image:
    """
    Convert a PIL image to an ASCII art image using the provided font and charset.
    - scale > 1.0 increases the number of characters (higher resolution ASCII grid)
    - invert swaps light/dark mapping
    - gamma adjusts perceived brightness mapping
    """
    # Convert to grayscale [0..255]
    gray = image.convert("L")

    if gamma and gamma != 1.0:
        arr = np.asarray(gray, dtype=np.float32) / 255.0
        arr = np.clip(arr, 0.0, 1.0) ** (1.0 / float(gamma))
        gray = Image.fromarray((arr * 255.0).astype(np.uint8), mode="L")

    cell_w, cell_h = measure_font_cell(font)

    # Number of character cells (columns x rows) in the ASCII grid
    cols = max(int(gray.width / max(cell_w, 1) * max(scale, 0.1)), 1)
    rows = max(int(gray.height / max(cell_h, 1) * max(scale, 0.1)), 1)

    # Downsample to grid resolution using area averaging for better fidelity
    grid = gray.resize((cols, rows), resample=Image.Resampling.BOX)
    grid_arr = np.asarray(grid, dtype=np.uint8)

    if invert:
        grid_arr = 255 - grid_arr

    # Map brightness to characters
    # Convert brightness [0..255] -> density_target [0..1] where 1=darkest ink
    density_target = 1.0 - (grid_arr.astype(np.float32) / 255.0)

    num_chars = len(charset_sorted)
    # Indices into charset (clip to bounds)
    indices = np.clip((density_target * (num_chars - 1)).round().astype(np.int32), 0, num_chars - 1)

    # Build text rows
    ascii_rows: List[str] = []
    for r in range(rows):
        row_chars = [charset_sorted[indices[r, c]] for c in range(cols)]
        ascii_rows.append("".join(row_chars))

    # Render ASCII text to an image
    out_w = cols * cell_w
    out_h = rows * cell_h
    out_img = Image.new("L", (out_w, out_h), color=255)
    draw = ImageDraw.Draw(out_img)

    # Draw each row as a single text call for speed
    y = 0
    for row_text in ascii_rows:
        draw.text((0, y), row_text, fill=0, font=font)
        y += cell_h

    return out_img.convert("RGB")


def process_single_image(
    input_path: Path,
    output_path: Path,
    font: ImageFont.ImageFont,
    charset_sorted: List[str],
    scale: float,
    invert: bool,
    gamma: float,
) -> None:
    with Image.open(str(input_path)) as im:
        ascii_img = image_to_ascii_image(im, font, charset_sorted, scale=scale, invert=invert, gamma=gamma)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        ascii_img.save(str(output_path))


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert images to high-resolution ASCII art images.")
    parser.add_argument(
        "--input-dir",
        type=str,
        required=True,
        help="Directory containing input images.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        required=True,
        help="Directory to write ASCII images to.",
    )
    parser.add_argument(
        "--font-path",
        type=str,
        default=None,
        help="Path to a monospaced TTF/TTC font. If omitted, a system mono font will be used if available.",
    )
    parser.add_argument(
        "--font-size",
        type=int,
        default=12,
        help="Font size in pixels (height). Smaller sizes yield more characters.",
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=2.0,
        help="ASCII grid scale factor. >1.0 uses more characters (higher resolution).",
    )
    parser.add_argument(
        "--invert",
        action="store_true",
        help="Invert light/dark mapping (produces white-on-black characters).",
    )
    parser.add_argument(
        "--gamma",
        type=float,
        default=1.0,
        help="Gamma correction for luminance mapping (e.g., 1.2 to brighten, 0.8 to darken).",
    )
    parser.add_argument(
        "--ext",
        type=str,
        default="png",
        help="Output image format/extension (e.g., png, jpg).",
    )

    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"Input dir does not exist or is not a directory: {input_dir}")

    font = find_monospaced_font(args.font_path, size=args.font_size)

    # A dense, diverse charset for smoother gradients
    base_charset = (
        " .`'^\",:;Il!i~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao"  # noqa: E501
        "*#MW&8%B@$"
    )
    # Ensure uniqueness and keep order
    seen = set()
    charset = "".join(ch for ch in base_charset if not (ch in seen or seen.add(ch)))
    charset_sorted = build_density_sorted_charset(font, charset)

    valid_exts = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}

    items = sorted([p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() in valid_exts])
    if not items:
        raise SystemExit(f"No images found in {input_dir}")

    for src in items:
        dst_name = f"{src.stem}_ascii.{args.ext.lower()}"
        dst = output_dir / dst_name
        print(f"Converting: {src.name} -> {dst}")
        process_single_image(
            input_path=src,
            output_path=dst,
            font=font,
            charset_sorted=charset_sorted,
            scale=args.scale,
            invert=args.invert,
            gamma=args.gamma,
        )
    print(f"Done. Wrote {len(items)} ASCII images to: {output_dir}")


if __name__ == "__main__":
    main()


