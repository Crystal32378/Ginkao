"""產生 Chrome 擴充用的銀杏葉 icon PNG (16/48/128)"""
from PIL import Image, ImageDraw
import os

OUT_DIR = "/home/z/my-project/download/ginkgo-extension/icons"
os.makedirs(OUT_DIR, exist_ok=True)


def draw_ginkgo(size: int) -> Image.Image:
    """畫一片銀杏葉 — 簡化的扇形 + 葉柄"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 銀杏暖金色 #D4A24C
    leaf_color = (212, 162, 76, 255)
    stem_color = (140, 100, 40, 255)

    cx, cy = size / 2, size * 0.55

    # 葉子扇形（用橢圓裁切上半部）
    leaf_w = size * 0.78
    leaf_h = size * 0.6
    bbox = (cx - leaf_w / 2, cy - leaf_h, cx + leaf_w / 2, cy)
    draw.pieslice(bbox, 180, 360, fill=leaf_color, outline=(140, 100, 40, 255), width=max(1, size // 32))

    # 葉柄
    stem_w = max(1, size // 32)
    draw.line([(cx, cy), (cx, size * 0.9)], fill=stem_color, width=stem_w)

    # 葉脈（中間分隔線 + 兩側斜線）
    vein_color = (140, 100, 40, 200)
    line_w = max(1, size // 48)
    # 中間垂直
    draw.line([(cx, cy - leaf_h * 0.7), (cx, cy)], fill=vein_color, width=line_w)
    # 左右斜線
    for angle_offset in [-0.3, -0.15, 0.15, 0.3]:
        end_x = cx + (leaf_w / 2) * angle_offset * 2
        end_y = cy - leaf_h * 0.1
        start_x = cx + (leaf_w / 4) * angle_offset
        start_y = cy - leaf_h * 0.8
        draw.line([(start_x, start_y), (end_x, end_y)], fill=vein_color, width=line_w)

    return img


for s in [16, 48, 128]:
    img = draw_ginkgo(s)
    img.save(os.path.join(OUT_DIR, f"ginkgo-{s}.png"))
    print(f"saved ginkgo-{s}.png")

print("done")
