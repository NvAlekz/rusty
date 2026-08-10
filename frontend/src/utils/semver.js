const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.]+)?$/;

export function parseSemVer(version) {
  const match = SEMVER_REGEX.exec(String(version).trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareSemVer(a, b) {
  const left = parseSemVer(a);
  const right = parseSemVer(b);
  if (!left || !right) return 0;

  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

export function isSemVerGreater(a, b) {
  return compareSemVer(a, b) > 0;
}
