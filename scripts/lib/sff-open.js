const fs = require('fs');
const { openSff, getSpriteAsync } = require('./sff-v2');
const { openSffV1, getSpriteV1 } = require('./sff-v1');

function openAnySff(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 11) !== 'ElecbyteSpr') {
    throw new Error(`Not an SFF: ${filePath}`);
  }
  const verhi = buf[15];
  if (verhi === 2) {
    const sff = openSff(filePath);
    return {
      version: 2,
      async get(group, number) {
        return getSpriteAsync(sff, group, number);
      },
      async tryGet(group, number) {
        try {
          return await getSpriteAsync(sff, group, number);
        } catch {
          return null;
        }
      },
    };
  }
  const sff = openSffV1(filePath);
  return {
    version: 1,
    async get(group, number) {
      return getSpriteV1(sff, group, number);
    },
    async tryGet(group, number) {
      try {
        return getSpriteV1(sff, group, number);
      } catch {
        return null;
      }
    },
  };
}

module.exports = { openAnySff };
