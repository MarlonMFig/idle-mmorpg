// raridade-potencial.js
//
// ESCOPO: só o sorteio de qualidade e o cálculo do qualityStatMultiplier.
// NÃO calcula ficha, não conhece estrelas, despertar, linhagem nem nível —
// essas camadas continuam onde estão. A única mudança no projeto é: o
// multiplicador deixa de ser sorteado e passa a ser DERIVADO do potencial.
//
// O sorteio roda no servidor. O cliente nunca informa o resultado.

export const CONFIG = {
  _leiaAtributos:
    'Um componente de potencial por atributo primário que o multiplicador ' +
    'afeta. Hoje o pipeline aplica quality em HP/força/defesa: são estes três. ' +
    'Quando SpA e Velocidade existirem, basta acrescentá-los aqui — o resto do ' +
    'arquivo se ajusta sozinho (total, faixas de grau e posição são calculados ' +
    'a partir do tamanho desta lista).',
  atributos: ['hp', 'forca', 'defesa'],

  _leiaQualidade:
    'peso = chance RELATIVA de sair, usada só depois que a captura já deu ' +
    'certo. Quem decide sucesso/fracasso é o pergaminho (computeCaptureChance) ' +
    '— NÃO ponha a falha aqui também, senão o jogador falha duas vezes e a ' +
    'taxa real cai pela metade sem aparecer em lugar nenhum. ' +
    'min/max = faixa do multiplicador. Os PONTOS MÉDIOS são os que o ' +
    'jogo já usava — o balanceamento médio não muda com esta implantação. ' +
    'A largura é sempre +-25% do médio: abaixo de +-17,5% o potencial vira ' +
    'decoração, acima de +-42% o topo de uma faixa passa o MÉDIO da seguinte ' +
    'e a qualidade perde o sentido.',
  _leiaIds:
    'id = o que está gravado no banco (D..SSS). rotulo = o que o jogador lê. ' +
    'Se os nomes divergirem em algum lugar do projeto, o id manda.',
  qualidades: [
    { id: 'D',   rotulo: 'Comum',    peso: 4500, min: 0.23, max: 0.38 },
    { id: 'C',   rotulo: 'Incomum',  peso: 1600, min: 0.32, max: 0.54 },
    { id: 'B',   rotulo: 'Raro',     peso:  500, min: 0.45, max: 0.75 },
    { id: 'A',   rotulo: 'Épico',    peso:  160, min: 0.68, max: 1.13 },
    { id: 'S',   rotulo: 'Lendário', peso:   40, min: 0.98, max: 1.63 },
    { id: 'SS',  rotulo: 'Mítico',   peso:    2, min: 1.35, max: 2.25 },
    { id: 'SSS', rotulo: 'Supremo',  peso: 0.25, min: 1.88, max: 3.13 },
  ],

  _leiaPotencial:
    'Um componente de 1 a 20 por atributo. Cada componente escala HP, força e ' +
    'defesa na faixa da qualidade. O TOTAL ainda define o grau interno.',
  potencial: { componenteMin: 1, componenteMax: 20 },

  _leiaGrau:
    'GRAU nunca é sorteado: é derivado do potencial. As faixas são em PERCENTUAL ' +
    'da posição (0 = pior possível, 1 = melhor), então continuam corretas se o ' +
    'número de atributos mudar de 3 para 5.',
  graus: [
    { id: 'bruto',     rotulo: 'Bruto',     ate: 0.58 },
    { id: 'lapidado',  rotulo: 'Lapidado',  ate: 0.73 },
    { id: 'fino',      rotulo: 'Fino',      ate: 0.84 },
    { id: 'excelente', rotulo: 'Excelente', ate: 0.95 },
    { id: 'perfeito',  rotulo: 'Perfeito',  ate: 1.01 },
  ],

  _leiaSorte:
    'sorte > 1 puxa a distribuição para as qualidades raras sem inverter a ' +
    'ordem (peso elevado a 1/sorte). Serve para pergaminho melhor, buff ou ' +
    'evento. 1 = tabela normal; 1,2 já é bem generoso; acima de 1,5 o Supremo ' +
    'deixa de ser raro.',
};

const rnd = (rng) => (rng ? rng() : Math.random());

/**
 * Sorteia QUAL qualidade saiu, depois que a captura já foi bem-sucedida.
 * Nunca falha — sucesso e fracasso são decididos antes, pelo pergaminho.
 * @param sorte  multiplicador de sorte opcional (>1 puxa para as raras)
 */
export function rollQuality({ rng, sorte = 1 } = {}) {
  const lista = CONFIG.qualidades;
  // sorte > 1 achata a curva a favor das raras sem alterar a ordem
  const pesos = lista.map((q) => (sorte === 1 ? q.peso : Math.pow(q.peso, 1 / sorte)));
  const total = pesos.reduce((s, p) => s + p, 0);

  let r = rnd(rng) * total;
  for (let i = 0; i < lista.length; i++) {
    if (r < pesos[i]) return lista[i].id;
    r -= pesos[i];
  }
  return lista[0].id;
}

/** Um componente de 1 a 20 por atributo. */
export function rollPotential(rng) {
  const { componenteMin: min, componenteMax: max } = CONFIG.potencial;
  const p = {};
  for (const a of CONFIG.atributos) {
    p[a] = min + Math.floor(rnd(rng) * (max - min + 1));
  }
  return p;
}

export const potentialTotal = (p) =>
  CONFIG.atributos.reduce((s, a) => s + (Math.trunc(p?.[a]) || 0), 0);

/** Posição normalizada 0..1 dentro do intervalo possível de potencial. */
export function potentialPosition(total) {
  const n = CONFIG.atributos.length;
  const { componenteMin: min, componenteMax: max } = CONFIG.potencial;
  const piso = n * min;
  const teto = n * max;
  return Math.min(1, Math.max(0, (total - piso) / (teto - piso)));
}

/** Grau DERIVADO do potencial — nunca sorteado. */
export function gradeFromPotential(total) {
  const pos = potentialPosition(total);
  for (const g of CONFIG.graus) if (pos < g.ate) return g.id;
  return CONFIG.graus[CONFIG.graus.length - 1].id;
}

/**
 * O NÚMERO QUE O PROJETO JÁ CONSOME.
 * Substitui rollQualityStatMultiplier: mesmo tipo de retorno, mesma faixa,
 * só que determinístico a partir do potencial em vez de sorteado.
 */
export function qualityStatMultiplierFromPotential(quality, potential) {
  const q = CONFIG.qualidades.find((x) => x.id === quality);
  if (!q) return 1;
  const pos = potentialPosition(potentialTotal(potential));
  return q.min + pos * (q.max - q.min);
}

/** Multiplicador de UM atributo a partir do componente 1–20. */
export function qualityStatMultiplierFromComponent(quality, component) {
  const q = CONFIG.qualidades.find((x) => x.id === quality);
  if (!q) return 1;
  const { componenteMin: min, componenteMax: max } = CONFIG.potencial;
  const raw = Number(component);
  const value = Number.isFinite(raw) ? raw : (min + max) / 2;
  const pos = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return q.min + pos * (q.max - q.min);
}

/**
 * Tudo que uma captura bem-sucedida precisa gravar.
 * Chame SÓ depois que attemptCapture já confirmou o sucesso.
 */
export function rollCaptureBundle({ rng, sorte = 1 } = {}) {
  const quality = rollQuality({ rng, sorte });
  const potential = rollPotential(rng);
  const total = potentialTotal(potential);
  return {
    quality,
    potential,
    potentialTotal: total,
    grade: gradeFromPotential(total),
    qualityStatMultiplier: qualityStatMultiplierFromPotential(quality, potential),
  };
}

/**
 * MIGRAÇÃO dos personagens já salvos, que não têm potencial.
 * Faz o caminho inverso: parte do multiplicador gravado, descobre que posição
 * ele ocupava na faixa e distribui os componentes em torno dela.
 * Ninguém perde nem ganha poder — o multiplicador resultante é o mesmo.
 */
export function backfillPotential(quality, storedMultiplier, rng) {
  const q = CONFIG.qualidades.find((x) => x.id === quality);
  const { componenteMin: min, componenteMax: max } = CONFIG.potencial;
  if (!q) return rollPotential(rng);

  const pos = Math.min(1, Math.max(0, (storedMultiplier - q.min) / (q.max - q.min)));
  const alvo = min + pos * (max - min);

  const p = {};
  for (const a of CONFIG.atributos) {
    // pequena variação em torno do alvo, para as fichas não saírem idênticas
    const ruido = (rnd(rng) - 0.5) * 2;
    p[a] = Math.min(max, Math.max(min, Math.round(alvo + ruido)));
  }
  return p;
}
