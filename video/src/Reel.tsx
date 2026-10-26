import { AbsoluteFill, Audio, interpolate, staticFile, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/google-fonts/NotoSansKR";
import { CardScene } from "./CardScene";
import { ProgressBar } from "./ProgressBar";
import { COLORS, TRANSITION_FRAMES } from "./theme";

const { fontFamily } = loadFont("normal", {
  weights: ["700"],
  subsets: ["korean", "latin"],
  ignoreTooManyRequestsWarning: true,
});

export type ReelCard = { image: string; durationInFrames: number; bg: string };
export type ReelProps = {
  id: string;
  title: string;
  cards: ReelCard[];
  audio: string | null;
};

export const Reel: React.FC<ReelProps> = ({ title, cards, audio }) => {
  const { durationInFrames } = useVideoConfig();
  const fadeOut = 45; // 끝에서 음악 페이드아웃 프레임 수

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <TransitionSeries>
        {cards.flatMap((card, i) => {
          const seq = (
            <TransitionSeries.Sequence
              key={`seq-${i}`}
              durationInFrames={card.durationInFrames}
            >
              <CardScene
                src={card.image}
                index={i}
                durationInFrames={card.durationInFrames}
                bg={card.bg}
              />
            </TransitionSeries.Sequence>
          );
          if (i === cards.length - 1) return [seq];
          return [
            seq,
            <TransitionSeries.Transition
              key={`tr-${i}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
            />,
          ];
        })}
      </TransitionSeries>

      <ProgressBar />

      {/* 카드에 자체 꼬리줄이 있는 회차는 config title 을 "" 로 비워 숨긴다 */}
      {title ? (
        <div
          style={{
            position: "absolute",
            bottom: 96,
            width: "100%",
            textAlign: "center",
            fontFamily,
            fontWeight: 700,
            fontSize: 34,
            letterSpacing: 2,
            color: COLORS.tanDeep,
          }}
        >
          생각하는 글밭 · {title}
        </div>
      ) : null}

      {audio ? (
        <Audio
          src={staticFile(audio)}
          loop
          volume={(f) =>
            interpolate(
              f,
              [0, 15, durationInFrames - fadeOut, durationInFrames],
              [0, 1, 1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
