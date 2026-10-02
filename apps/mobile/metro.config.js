// Expo's default Metro config detects the npm workspace, so @pantry/shared resolves from the repo root.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
