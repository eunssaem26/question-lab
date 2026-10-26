import { useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, W } from "./theme";

// 영상 전체 진행도를 보여주는 상단 바 (전역 프레임 기준)
export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(1, frame / (durationInFrames - 1));

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: W,
        height: 8,
        backgroundColor: "rgba(92,61,46,0.12)",
      }}
    >
      <div
        style={{
          width: W * progress,
          height: "100%",
          backgroundColor: COLORS.green,
        }}
      />
    </div>
  );
};
