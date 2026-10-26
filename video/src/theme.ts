// 브랜드 토큰 — site/public/cardnews/*.html 의 카드 CSS에서 추출
export const COLORS = {
  bg: "#E8D5C0", // body 배경 (여백 밴드)
  cream: "#F5E6D0",
  brown: "#5C3D2E", // 진한 브라운 (텍스트)
  tan: "#C4956A",
  tanDeep: "#A67B5B",
  green: "#6B7F4A", // 강조 (진행 바)
};

// 9:16 캔버스
export const W = 1080;
export const H = 1920;
export const FPS = 30;

// 카드 원본 크기 (1080×1350, 4:5)
export const CARD_W = 1080;
export const CARD_H = 1350;

// 카드를 세로 프레임 중앙에 배치했을 때의 상단 오프셋
export const CARD_TOP = Math.round((H - CARD_H) / 2); // 285

// 씬 사이 전환 길이(프레임)
export const TRANSITION_FRAMES = 18;

export const FONT_FAMILY = "'Noto Sans KR', sans-serif";
