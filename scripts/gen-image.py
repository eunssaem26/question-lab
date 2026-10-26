#!/usr/bin/env python3
"""이미지 생성기 — OpenAI GPT Image 2 (헤르메스 Codex OAuth 경유).

Gemini는 쓰지 않는다. 별도 API 키도 필요 없다 — 헤르메스가 이미 들고 있는
Codex OAuth 토큰을 그대로 쓴다.

    scripts/gen-image.py "프롬프트" 저장경로.png [--ratio 16:9] [--quality high]

  --ratio    1:1 · 16:9 · 9:16 · 4:3 · 3:4   (기본 1:1)
  --quality  low(~15초) · medium(~40초) · high(~2분)   (기본 medium)

프롬프트는 영어가 결과가 좋다. 한국어로 받았으면 영어로 옮겨서 넣을 것.
"""
import argparse
import base64
import pathlib
import sys
import urllib.request

HERMES = pathlib.Path.home() / ".hermes/hermes-agent"


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("prompt")
    ap.add_argument("out")
    ap.add_argument("--ratio", default="1:1")
    ap.add_argument("--quality", default="medium", choices=["low", "medium", "high"])
    a = ap.parse_args()

    if not HERMES.exists():
        sys.exit(f"헤르메스를 찾을 수 없습니다: {HERMES}")
    sys.path.insert(0, str(HERMES))

    from hermes_cli.plugins import _ensure_plugins_discovered
    from agent.image_gen_registry import get_provider

    _ensure_plugins_discovered()
    provider = get_provider("openai-codex")
    if not provider:
        sys.exit("openai-codex 이미지 플러그인이 없습니다")
    if not provider.is_available():
        sys.exit("Codex 토큰이 없거나 만료됐습니다. `hermes login` 후 다시 시도하세요")

    print(f"생성 중… ({a.quality}, {a.ratio})", flush=True)
    res = provider.generate(a.prompt, a.ratio, model=f"gpt-image-2-{a.quality}")

    if not isinstance(res, dict) or res.get("error"):
        sys.exit(f"실패: {res.get('error') if isinstance(res, dict) else res}")

    # 플러그인은 캐시에 저장한 뒤 경로(또는 URL)를 image 로 돌려준다
    src = res.get("image") or res.get("image_url") or res.get("url")
    data = None
    if isinstance(src, str) and src:
        if src.startswith("data:"):
            data = base64.b64decode(src.split(",", 1)[1])
        elif src.startswith("http"):
            with urllib.request.urlopen(src) as r:
                data = r.read()
        else:
            sp = pathlib.Path(src)
            if sp.exists():
                data = sp.read_bytes()
    if data is None:
        for key in ("image_base64", "b64_json"):
            if isinstance(res.get(key), str) and len(res[key]) > 100:
                data = base64.b64decode(res[key]); break
    if data is None:
        sys.exit(f"이미지를 응답에서 찾지 못했습니다. 키: {list(res)}")

    out = pathlib.Path(a.out).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    print(f"✓ {out}  ({len(data):,} bytes)")


if __name__ == "__main__":
    main()
