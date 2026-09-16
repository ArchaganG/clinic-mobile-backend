const parseMaybeJson = (value) => {
  if (value == null || value === '') return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

module.exports = { parseMaybeJson };
