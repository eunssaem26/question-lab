#!/usr/bin/env python3
"""교무실 아바타 생성기 — 원본 캐릭터 이미지에서 512² 원형용 얼굴 컷을 뽑는다.

원본들이 정사각·세로·16:9로 제각각이고 인물 크기도 달라서, 캐릭터마다
얼굴 위치와 확대율을 따로 잡아 둔다. 이 수치가 없으면 재생성할 때마다
얼굴이 작거나 아래로 쏠린다(은쌤이 그랬다).

    python3 office/make_avatars.py            # 전체
    python3 office/make_avatars.py eunsaem    # 한 명만

수치 조정법: cy를 줄이면 위로, scale을 줄이면 확대된다.
"""
import sys
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "site/src/assets/characters"
OUT = pathlib.Path(__file__).resolve().parent / "assets/avatars"
SIZE = 512

# 프로필ID: (원본파일, 가로중심, 세로중심, 크롭변 비율 — 짧은변 대비)
SPEC = {
    "philo":     ("philo_clay.png",          0.49, 0.32, 0.63),   # 귀까지 포함해 당김
    "byeolsaem": ("byeolsaem_clay.png",      0.50, 0.36, 0.61),   # 귀~어깨: 목 잘림 방지로 아래로
    "chaeksaem": ("chaeksaem_clay.png",      0.485, 0.32, 0.57),  # 학사모 끝~턱 = y12~52%
    "geulsaem":  ("geulsaem_clay.png",       0.46, 0.39, 0.46),   # 베레모 포함
    "hogi":      ("hogi_clay.png",           0.52, 0.41, 0.47),
    # 은쌤 원본은 전신컷이라 얼굴이 작다. 실측 얼굴 위치 y=420~837px(원본 1792x2400)
    # 기준으로 얼굴이 프레임의 약 53%를 차지하도록 당겼다.
    "eunsaem":   ("eunsaem_clay.png",        0.52, 0.27, 0.44),
    "kkansaem":  ("kkansaem_clay.png",       0.52, 0.29, 0.56),   # 까마귀라 어두워 더 크게
    # 신규 3명은 16:9 책상 장면이라 짧은변(세로) 기준으로 정사각을 딴다.
    "yeongsaem": ("yeongsaem_clay_16x9.png", 0.45, 0.35, 0.70),   # 머리 y5~52% 실측, 1.43배 확대
    "batpd":     ("batpd_clay_16x9.png",     0.51, 0.25, 0.55),
    "gardener":  ("gardener_clay_16x9.png",  0.51, 0.27, 0.49),
}


def build(name):
    fn, cx, cy, scale = SPEC[name]
    src = SRC / fn
    if not src.exists():
        print(f"  ✗ {name}: 원본 없음 {src}")
        return False
    im = Image.open(src).convert("RGB")
    W, H = im.size
    side = int(min(W, H) * scale)
    x = max(0, min(int(W * cx - side / 2), W - side))
    y = max(0, min(int(H * cy - side / 2), H - side))
    OUT.mkdir(parents=True, exist_ok=True)
    im.crop((x, y, x + side, y + side)) \
      .resize((SIZE, SIZE), Image.LANCZOS) \
      .save(OUT / f"{name}.png", optimize=True)
    print(f"  ✓ {name:10} {W}x{H} → {side}px @({x},{y}) → {SIZE}²")
    return True


if __name__ == "__main__":
    targets = sys.argv[1:] or list(SPEC)
    unknown = [t for t in targets if t not in SPEC]
    if unknown:
        sys.exit(f"모르는 캐릭터: {', '.join(unknown)}\n가능: {', '.join(SPEC)}")
    for t in targets:
        build(t)
