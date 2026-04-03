// metro.config.js
// Expo 기본 Metro 설정 + SVG 지원

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SVG 파일을 transformer로 처리 (react-native-svg-transformer 설치 시)
// 현재는 react-native-svg 컴포넌트로 직접 구현하므로 기본 설정으로 충분
const { assetExts, sourceExts } = config.resolver;

// 필요시 SVG transformer 활성화 (선택)
// config.transformer = {
//   ...config.transformer,
//   babelTransformerPath: require.resolve('react-native-svg-transformer'),
// };
// config.resolver = {
//   ...config.resolver,
//   assetExts: assetExts.filter(ext => ext !== 'svg'),
//   sourceExts: [...sourceExts, 'svg'],
// };

module.exports = config;
