"""Generate original Chrome Web Store promo art from the bundled Quiet Browse icon."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets"
ICON = Image.open(ROOT / "extension" / "icons" / "icon128.png").convert("RGBA")
REGULAR = "/System/Library/Fonts/Supplemental/Verdana.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Verdana Bold.ttf"

COLORS = {
    "bg": "#F7F8F3",
    "panel": "#E8EFE4",
    "text": "#203B30",
    "muted": "#52685D",
    "brand": "#285C43",
    "cream": "#EFF2D2",
}


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REGULAR, size)


def icon_card(canvas, box, icon_size):
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(box, radius=int((box[2] - box[0]) * .22), fill=COLORS["panel"], outline="#C9D5C8", width=2)
    x = box[0] + (box[2] - box[0] - icon_size) // 2
    y = box[1] + (box[3] - box[1] - icon_size) // 2
    canvas.alpha_composite(ICON.resize((icon_size, icon_size), Image.Resampling.LANCZOS), (x, y))


def small_promo():
    image = Image.new("RGBA", (440, 280), COLORS["bg"])
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((14, 14, 426, 266), radius=26, outline="#C9D5C8", width=2)
    draw.text((32, 30), "QUIET BROWSE", font=font(13, True), fill=COLORS["brand"])
    draw.multiline_text((32, 67), "Calmer pages.\nChoices intact.", font=font(30, True), fill=COLORS["text"], spacing=7)
    icon_card(image, (300, 40, 402, 142), 80)
    labels = [("PAGING", 32, 206), ("GRAYSCALE", 129, 206), ("FEED CONTROLS", 254, 206)]
    for label, x, y in labels:
        width = draw.textbbox((0, 0), label, font=font(10, True))[2]
        draw.rounded_rectangle((x - 9, y - 7, x + width + 9, y + 23), radius=12, fill=COLORS["panel"])
        draw.text((x, y), label, font=font(10, True), fill=COLORS["muted"])
    return image.convert("RGB")


def marquee():
    image = Image.new("RGBA", (1400, 560), COLORS["bg"])
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((34, 34, 1366, 526), radius=46, outline="#C9D5C8", width=3)
    draw.ellipse((1010, -160, 1500, 330), fill=COLORS["cream"])
    draw.text((90, 78), "QUIET BROWSE", font=font(22, True), fill=COLORS["brand"])
    draw.multiline_text(
        (86, 145),
        "Calmer pages.\nYour choices intact.",
        font=font(62, True),
        fill=COLORS["text"],
        spacing=10,
    )
    draw.text((90, 350), "Local-first controls for lower-stimulation browsing.", font=font(23), fill=COLORS["muted"])
    icon_card(image, (1045, 105, 1295, 355), 190)
    for text, x in [("Instant paging", 90), ("Adjustable grayscale", 318), ("Social controls", 610)]:
        width = draw.textbbox((0, 0), text, font=font(17, True))[2]
        draw.rounded_rectangle((x - 18, 435, x + width + 18, 482), radius=20, fill=COLORS["panel"])
        draw.text((x, 447), text, font=font(17, True), fill=COLORS["text"])
    return image.convert("RGB")


def main():
    OUT.mkdir(exist_ok=True)
    ICON.save(OUT / "store-icon-128.png")
    small_promo().save(OUT / "small-promo-440x280.png", optimize=True)
    marquee().save(OUT / "marquee-1400x560.png", optimize=True)
    print("Generated store icon, required small promo tile, and optional marquee tile.")


if __name__ == "__main__":
    main()
