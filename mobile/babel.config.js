// babel.config.js
// react-native-reanimated/plugin 은 반드시 마지막에 와야 함 (공식 문서)

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated 플러그인 (항상 마지막!)
      'react-native-reanimated/plugin',
    ],
  };
};
