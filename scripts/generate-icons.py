"""Gera os ícones do PWA (casa branca com "R$" sobre fundo verde).

Uso: python3 scripts/generate-icons.py
"""
from PIL import Image, ImageDraw, ImageFont

GREEN = (4, 120, 87)
WHITE = (255, 255, 255)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def draw_icon(size: int, maskable: bool, rounded: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size * 0.22, fill=GREEN)
    else:
        d.rectangle([0, 0, size, size], fill=GREEN)

    # Área segura: maskable usa só os 80% centrais.
    s = size * (0.62 if maskable else 0.74)
    cx, cy = size / 2, size / 2 + s * 0.04
    left, right = cx - s / 2, cx + s / 2
    roof_top = cy - s / 2
    eave = cy - s * 0.08
    bottom = cy + s / 2
    wall_in = s * 0.14
    d.polygon([(cx, roof_top), (right, eave), (left, eave)], fill=WHITE)
    d.rectangle([left + wall_in, eave - 1, right - wall_in, bottom], fill=WHITE)

    font = ImageFont.truetype(FONT, int(s * 0.30))
    text = "R$"
    box = d.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    ty = eave + (bottom - eave) / 2 - th / 2 - box[1]
    d.text((cx - tw / 2 - box[0], ty), text, font=font, fill=GREEN)
    return img


for size in (192, 512):
    draw_icon(size, maskable=False, rounded=True).save(f"public/icons/icon-{size}.png")
draw_icon(512, maskable=True, rounded=False).save("public/icons/icon-maskable-512.png")
draw_icon(180, maskable=False, rounded=False).convert("RGB").save("public/icons/apple-touch-icon.png")
draw_icon(32, maskable=False, rounded=True).save("public/icons/favicon-32.png")
print("ícones gerados em public/icons/")
