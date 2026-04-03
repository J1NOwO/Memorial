// DollAvatar.jsx - DollFigure 래퍼
// 기존 코드에서 DollAvatar를 쓰는 곳은 그대로 두고 여기서 DollFigure로 연결

import DollFigure from './DollFigure';

export default function DollAvatar({ appearance = {}, size = 120, animated = false }) {
  return <DollFigure appearance={appearance} size={size} animated={animated}/>;
}
