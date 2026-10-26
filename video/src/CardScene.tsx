import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CARD_TOP, CARD_W, CARD_H } from "./theme";

type Props = {
  src: string; // staticFile 상대경로 (예: "cards/03/01.png")
  index: number;
  durationInFrames: number;
  bg: string; // 카드 배경색 — 여백 밴드를 같은 색으로 채움
};

// 카드 1장을 9:16 프레임 중앙에 배치하고 은은한 켄번스를 적용
export const CardScene: React.FC<Props> = ({ src, index, durationInFrames, bg }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 짝/홀수 카드마다 줌 방향을 번갈아 (살짝 살아있는 느낌)
  const zoomIn = index % 2 === 0;
  const scale = zoomIn ? 1 + t * 0.04 : 1.04 - t * 0.04;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          top: CARD_TOP,
          left: 0,
          width: CARD_W,
          height: CARD_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </AbsoluteFill>
  );
};
