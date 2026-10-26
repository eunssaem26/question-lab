#!/usr/bin/env python3
"""아이소메트릭 방 이미지에 한글을 원근 맞춰 얹는다.

생성 AI는 한글을 거의 항상 깨뜨린다. 그래서 배경은 **글자 없이** 생성하고,
글자는 여기서 실제 폰트로 그려 넣는다. 칠판·문패처럼 기울어진 면에는
네 꼭짓점을 주면 원근 변환으로 맞춰 붙인다.

    python3 office/add_korean_text.py

수정할 것은 아래 PLATES 리스트뿐이다. 꼭짓점은 원본 이미지의 픽셀 좌표이며
좌상 → 우상 → 우하 → 좌하 순서다.
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
FONT_CANDIDATES = [
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        if pathlib.Path(path).exists():
            try:
                return ImageFont.truetype(path, size, index=2)  # SemiBold
            except Exception:
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    continue
    sys.exit("한글 폰트를 찾지 못했습니다")


def perspective_coeffs(dst_quad, w, h):
    """(0,0)-(w,h) 사각형을 dst_quad 로 보내는 역변환 계수."""
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    A, B = [], []
    for (sx, sy), (dx, dy) in zip(src, dst_quad):
        A.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        A.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
        B += [sx, sy]
    # 8x8 가우스 소거 (numpy 없이)
    M = [row[:] + [b] for row, b in zip(A, B)]
    n = 8
    for i in range(n):
        piv = max(range(i, n), key=lambda r: abs(M[r][i]))
        if abs(M[piv][i]) < 1e-12:
            raise ValueError("퇴화된 사각형입니다 — 꼭짓점을 다시 확인하세요")
        M[i], M[piv] = M[piv], M[i]
        f = M[i][i]
        M[i] = [v / f for v in M[i]]
        for r in range(n):
            if r == i:
                continue
            g = M[r][i]
            if g:
                M[r] = [a - g * b2 for a, b2 in zip(M[r], M[i])]
    return tuple(M[r][n] for r in range(n))


def draw_plate(base, quad, lines, color, font_ratio=0.42, gap=0.14):
    """quad 안에 lines 를 가운데 정렬로 그린다."""
    xs = [p[0] for p in quad]; ys = [p[1] for p in quad]
    w = int(max(xs) - min(xs)); h = int(max(ys) - min(ys))
    if w < 8 or h < 8:
        return
    # 여유 있게 2배 해상도로 그린 뒤 축소 → 가장자리가 매끄럽다
    W, H = w * 2, h * 2
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    n = len(lines)
    fs = int(H * font_ratio / max(1, n) * (1 + gap))
    font = load_font(fs)
    heights, widths = [], []
    for ln in lines:
        bb = d.textbbox((0, 0), ln, font=font)
        widths.append(bb[2] - bb[0]); heights.append(bb[3] - bb[1])
    # 폭이 넘치면 줄인다
    while max(widths) > W * 0.9 and fs > 8:
        fs = int(fs * 0.92); font = load_font(fs)
        widths = [d.textbbox((0, 0), ln, font=font)[2] for ln in lines]
        heights = [d.textbbox((0, 0), ln, font=font)[3] for ln in lines]
    total = sum(heights) + int(H * gap) * (n - 1)
    y = (H - total) // 2
    for ln, hh in zip(lines, heights):
        bb = d.textbbox((0, 0), ln, font=font)
        d.text(((W - (bb[2] - bb[0])) // 2 - bb[0], y - bb[1]), ln, font=font, fill=color)
        y += hh + int(H * gap)

    shifted = [(x - min(xs), y2 - min(ys)) for x, y2 in quad]
    coeffs = perspective_coeffs(shifted, W, H)
    warped = layer.transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    base.alpha_composite(warped, (int(min(xs)), int(min(ys))))


# ---------------------------------------------------------------------------
# 벽에 붙일 그림 (원본 픽셀 좌표의 사각 영역에 알파 그대로 얹는다)
# ---------------------------------------------------------------------------
STICKERS = [
    # 벽의 둥근 액자 → 생각하는 글밭 간판. 액자 테두리를 완전히 덮도록 살짝 크게.
    dict(src="assets/logo_round.png", box=(1176, 96, 1282, 202),
         inset=58, shadow=0.55),   # 알파는 27px부터, 크림색 띠가 55px까지 → 58 잘라냄
]

# ---------------------------------------------------------------------------
# 기울어진 면에 얹을 글자 (좌상 → 우상 → 우하 → 좌하)
# 칠판 글씨는 어색해서 뺐다. 브랜드는 위 간판이 대신한다.
# ---------------------------------------------------------------------------
PLATES = []


def paste_sticker(base, spec):
    """알파 PNG를 벽에 붙인다.

    ``inset``: 원본 기준으로 가장자리에서 잘라낼 픽셀 수. 로고의 알파 원이
    실제 테두리보다 크면 배경색이 얇은 띠로 남아 흰 테두리처럼 보인다.
    ``shadow``: 벽에 뜬 느낌이 나지 않도록 아래에 깔 그림자 세기(0이면 없음).
    """
    src = pathlib.Path(spec["src"]).expanduser()
    if not src.is_absolute():
        src = HERE / src
    if not src.exists():
        print(f"  ✗ 그림 없음: {src}")
        return False
    img = Image.open(src).convert("RGBA")
    inset = int(spec.get("inset", 0))
    if inset:
        w0, h0 = img.size
        img = img.crop((inset, inset, w0 - inset, h0 - inset))

    x0, y0, x1, y1 = spec["box"]
    w, h = x1 - x0, y1 - y0
    img = img.resize((w, h), Image.LANCZOS)

    # 원형으로 다시 깎아 가장자리를 매끄럽게 (4배 오버샘플링)
    if spec.get("circle", True):
        S = 4
        m = Image.new("L", (w * S, h * S), 0)
        ImageDraw.Draw(m).ellipse((0, 0, w * S - 1, h * S - 1), fill=255)
        mask = m.resize((w, h), Image.LANCZOS)
        a = img.split()[-1]
        img.putalpha(Image.composite(a, Image.new("L", (w, h), 0), mask))

    sh = float(spec.get("shadow", 0))
    if sh > 0:
        from PIL import ImageFilter
        blur = max(2, int(min(w, h) * 0.06))
        pad = blur * 3
        sl = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
        sl.paste((40, 24, 10, int(150 * sh)), (pad, pad), img.split()[-1])
        sl = sl.filter(ImageFilter.GaussianBlur(blur))
        base.alpha_composite(sl, (x0 - pad, y0 - pad + int(h * 0.04)))

    base.alpha_composite(img, (x0, y0))
    print(f"  ✓ {src.name} → ({x0},{y0})-({x1},{y1}) inset={inset}")
    return True


def main():
    src = HERE / "assets/office_iso_blank.png"
    out = HERE / "assets/office_iso.png"
    if not src.exists():
        sys.exit(f"글자 없는 배경이 없습니다: {src}")
    base = Image.open(src).convert("RGBA")
    print(f"배경 {base.size}")
    for s in STICKERS:
        paste_sticker(base, s)
    for p in PLATES:
        draw_plate(base, p["quad"], p["lines"], p["color"], p.get("font_ratio", 0.42))
        print(f"  ✓ {' / '.join(p['lines'])}")
    base.convert("RGB").save(out, optimize=True)
    print(f"→ {out}")


if __name__ == "__main__":
    main()
