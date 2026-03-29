const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude .local directory — contains volatile Replit workflow-log files
// that disappear mid-watch and crash Metro's FallbackWatcher (ENOENT).
// The blockList regex is respected by metro-file-map's FallbackWatcher ignore list.
const localDir = path.join(__dirname, ".local");
// Escape every special regex character in the absolute path
const escapedLocalDir = localDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

config.resolver = {
  ...config.resolver,
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
      ? [config.resolver.blockList]
      : []),
    // Match anything inside .local/
    new RegExp(`^${escapedLocalDir}[\\/]`),
  ],
};

module.exports = config;
