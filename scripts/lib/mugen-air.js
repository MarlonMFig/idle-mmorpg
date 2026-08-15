function parseAir(text) {
  const actions = new Map();
  let id = null;
  let frames = [];
  let ticks = 0;
  let hitTicks = null;
  let pendingHit = false;
  let comment = '';
  let pendingName = '';

  const flush = () => {
    if (id == null) return;
    const next = {
      frames,
      hitTicks,
      durationTicks: ticks,
      name: pendingName || `Action ${id}`,
    };
    const prev = actions.get(id);
    if (prev && prev.frames.length >= next.frames.length) return;
    actions.set(id, next);
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith(';')) {
      const c = line.replace(/^;+\s*/, '').trim();
      if (c && !/^[-*=]+$/.test(c) && c.length < 48) comment = c;
      continue;
    }
    const begin = line.match(/^\[Begin Action (\d+)\]/i);
    if (begin) {
      flush();
      id = Number(begin[1]);
      frames = [];
      ticks = 0;
      hitTicks = null;
      pendingHit = false;
      pendingName = comment;
      comment = '';
      continue;
    }
    if (/^Clsn1/i.test(line)) pendingHit = true;
    const m = line.match(/^(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/);
    if (!m || id == null) continue;
    const group = Number(m[1]);
    const number = Number(m[2]);
    const time = Math.max(1, Number(m[5]));
    if (group < 0) {
      ticks += time;
      continue;
    }
    // group,number,x,y,time[,flip[,trans]] — trans A/AS/A1 = additive blending.
    const trans = (line.split(',')[6] || '').trim().toUpperCase();
    frames.push({ group, number, time, hit: pendingHit, trans });
    if (pendingHit && hitTicks == null) hitTicks = ticks;
    ticks += time;
    if (pendingHit) pendingHit = false;
  }
  flush();
  return actions;
}

function collapse(frames) {
  const out = [];
  for (const frame of frames) {
    const prev = out[out.length - 1];
    if (prev && prev.group === frame.group && prev.number === frame.number) {
      prev.time += frame.time;
      continue;
    }
    out.push({ ...frame });
  }
  return out;
}

module.exports = { parseAir, collapse };
