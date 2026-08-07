/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Parser do items.otb (OpenTibia item database).
 *
 * O OTBM guarda IDs de *servidor*; o Tibia.dat é indexado por IDs de *cliente*.
 * O items.otb é a tabela que liga os dois — sem ela todo sprite sai trocado.
 *
 * Formato: mesma árvore de nós do OTBM (0xFE inicia, 0xFF encerra, 0xFD escapa).
 * Cada nó filho da raiz é um item; seus atributos são triplas (u8 attr, u16 len, data).
 */
const fs = require('fs');

const NODE_START = 0xfe;
const NODE_END = 0xff;
const ESCAPE = 0xfd;

const ATTR_SERVER_ID = 0x10;
const ATTR_CLIENT_ID = 0x11;
const ATTR_NAME = 0x12;

/** Lê as propriedades cruas de um nó, removendo os bytes de escape. */
function readProps(buf, pos) {
  const out = [];
  while (pos < buf.length) {
    const byte = buf[pos];
    if (byte === ESCAPE) {
      out.push(buf[pos + 1]);
      pos += 2;
      continue;
    }
    if (byte === NODE_START || byte === NODE_END) break;
    out.push(byte);
    pos += 1;
  }
  return { props: Buffer.from(out), next: pos };
}

function parseItemNode(type, props) {
  if (props.length < 4) return null;
  let pos = 4; // flags u32

  let serverId = null;
  let clientId = null;
  let name = null;

  while (pos + 3 <= props.length) {
    const attr = props[pos];
    const len = props.readUInt16LE(pos + 1);
    const dataStart = pos + 3;
    if (dataStart + len > props.length) break;

    if (attr === ATTR_SERVER_ID && len >= 2) {
      serverId = props.readUInt16LE(dataStart);
    } else if (attr === ATTR_CLIENT_ID && len >= 2) {
      clientId = props.readUInt16LE(dataStart);
    } else if (attr === ATTR_NAME) {
      name = props.toString('utf8', dataStart, dataStart + len);
    }

    pos = dataStart + len;
  }

  if (serverId == null) return null;
  return { serverId, clientId, name, group: type };
}

function parseOtb(buf) {
  // Cabeçalho: u32 version, depois o nó raiz.
  let pos = 4;
  if (buf[pos] !== NODE_START) {
    throw new Error(`items.otb: nó raiz ausente em ${pos}`);
  }
  pos += 1;
  pos += 1; // tipo do nó raiz
  pos = readProps(buf, pos).next;

  const items = [];

  while (pos < buf.length) {
    if (buf[pos] === NODE_END) {
      pos += 1;
      break;
    }
    if (buf[pos] !== NODE_START) {
      pos += 1;
      continue;
    }

    pos += 1;
    const type = buf[pos];
    pos += 1;
    const { props, next } = readProps(buf, pos);
    pos = next;

    const item = parseItemNode(type, props);
    if (item) items.push(item);

    // Itens não têm filhos, mas mantemos a varredura tolerante.
    let depth = 1;
    while (pos < buf.length && depth > 0) {
      const byte = buf[pos];
      if (byte === ESCAPE) {
        pos += 2;
        continue;
      }
      if (byte === NODE_START) depth += 1;
      else if (byte === NODE_END) depth -= 1;
      pos += 1;
      if (depth === 0) break;
    }
  }

  return items;
}

/** serverId → clientId, ignorando itens sem sprite associado. */
function buildServerToClientMap(otbPath) {
  const items = parseOtb(fs.readFileSync(otbPath));
  const map = new Map();
  for (const item of items) {
    if (item.clientId) map.set(item.serverId, item.clientId);
  }
  return { map, items };
}

module.exports = { parseOtb, buildServerToClientMap };

if (require.main === module) {
  const target = process.argv[2];
  const { map, items } = buildServerToClientMap(target);
  const identity = [...map.entries()].filter(([s, c]) => s === c).length;
  console.log({
    items: items.length,
    mapped: map.size,
    identityMappings: identity,
    sample: [...map.entries()].slice(0, 5),
    probe4608: map.get(4608),
    probe18320: map.get(18320),
  });
}
