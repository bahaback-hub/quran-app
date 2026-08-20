from pathlib import Path
import sys
from PIL import Image, ImageDraw


RES = Path('/home/ubuntu/quran-app-repair/android/app/src/main/res')

# Legacy launcher sizes and adaptive foreground sizes in pixels for each density.
DENSITIES = {
    'mdpi': (48, 108),
    'hdpi': (72, 162),
    'xhdpi': (96, 216),
    'xxhdpi': (144, 324),
    'xxxhdpi': (192, 432),
}


def resize(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def rounded_circle(image: Image.Image) -> Image.Image:
    mask = Image.new('L', image.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, image.width - 1, image.height - 1), fill=255)
    result = image.copy()
    result.putalpha(mask)
    return result


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/process-app-icon.py /absolute/path/to/icon.png')

    source_path = Path(sys.argv[1]).expanduser().resolve()
    if not source_path.exists():
        raise FileNotFoundError(f'Icon source does not exist: {source_path}')

    source = Image.open(source_path).convert('RGBA')
    for density, (legacy_size, foreground_size) in DENSITIES.items():
        directory = RES / f'mipmap-{density}'
        directory.mkdir(parents=True, exist_ok=True)

        legacy = resize(source, legacy_size)
        legacy.save(directory / 'ic_launcher.png', optimize=True)
        rounded_circle(legacy).save(directory / 'ic_launcher_round.png', optimize=True)
        resize(source, foreground_size).save(directory / 'ic_launcher_foreground.png', optimize=True)

    print('Generated Android launcher icon resources from', source_path)


if __name__ == '__main__':
    main()
