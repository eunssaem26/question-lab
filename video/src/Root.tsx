import { Composition, staticFile } from "remotion";
import { Reel, ReelProps, ReelCard } from "./Reel";
import { W, H, FPS, TRANSITION_FRAMES } from "./theme";

// TransitionSeries 의 실제 길이 = 카드 길이 합 - (전환 수 × 전환 길이)
const totalFrames = (cards: ReelCard[]) =>
  Math.max(
    1,
    cards.reduce((s, c) => s + c.durationInFrames, 0) -
      Math.max(0, cards.length - 1) * TRANSITION_FRAMES
  );

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={Reel}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={300}
      defaultProps={{ id: "03", title: "", cards: [], audio: null } as ReelProps}
      calculateMetadata={async ({ props }) => {
        // --props 로 카드가 직접 전달되면 그대로, 아니면 config/<id>.json 을 읽음
        let cfg: ReelProps = props as ReelProps;
        if (!cfg.cards || cfg.cards.length === 0) {
          const res = await fetch(staticFile(`config/${cfg.id}.json`));
          cfg = (await res.json()) as ReelProps;
        }
        return {
          durationInFrames: totalFrames(cfg.cards),
          fps: FPS,
          width: W,
          height: H,
          props: cfg,
        };
      }}
    />
  );
};
