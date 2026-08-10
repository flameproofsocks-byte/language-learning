// Word relation graph edges used by the D3 knowledge graph.
//
// Relations are language-specific: WORD_RELATIONS for Spanish (es),
// MANDARIN_RELATIONS_MAP for Mandarin (zh). Indonesian has no relations yet.
//
// Edge colours: antonym=red (dashed), synonym=green, category=blue, domain=purple (dashed).
// Only edges where BOTH nodes have been encountered (level ≥2) are drawn.

export type RelationType = 'antonym' | 'synonym' | 'category' | 'domain'

export interface WordRelation {
  from: string
  to: string
  type: RelationType
}

export const RELATION_COLOR: Record<RelationType, string> = {
  antonym:  '#f87171',   // red
  synonym:  '#4ade80',   // green
  category: '#60a5fa',   // blue
  domain:   '#a78bfa',   // purple (dashed)
}

export const WORD_RELATIONS: WordRelation[] = [

  // ── ANTONYMS (red) ──────────────────────────────────────────────────────────
  { from: 'w035', to: 'w039', type: 'antonym' },  // hombre ↔ mujer
  { from: 'w052', to: 'w064', type: 'antonym' },  // grande ↔ pequeño
  { from: 'w053', to: 'w065', type: 'antonym' },  // nuevo ↔ viejo
  { from: 'w066', to: 'w065', type: 'antonym' },  // joven ↔ viejo
  { from: 'w072', to: 'w082', type: 'antonym' },  // más ↔ menos
  { from: 'w056', to: 'w057', type: 'antonym' },  // mucho ↔ poco
  { from: 'w091', to: 'w094', type: 'antonym' },  // con ↔ sin
  { from: 'w068', to: 'w069', type: 'antonym' },  // fácil ↔ difícil
  { from: 'w060', to: 'w062', type: 'antonym' },  // primero ↔ último
  { from: 'w033', to: 'w048', type: 'antonym' },  // día ↔ noche
  { from: 'w191', to: 'w192', type: 'antonym' },  // aquí ↔ allí
  { from: 'w193', to: 'w194', type: 'antonym' },  // cerca ↔ lejos
  { from: 'w070', to: 'w185', type: 'antonym' },  // rápido ↔ lento
  { from: 'w186', to: 'w187', type: 'antonym' },  // temprano ↔ tarde
  { from: 'w176', to: 'w177', type: 'antonym' },  // limpio ↔ sucio
  { from: 'w178', to: 'w179', type: 'antonym' },  // lleno ↔ vacío
  { from: 'w188', to: 'w189', type: 'antonym' },  // caliente ↔ frío
  { from: 'w067', to: 'w173', type: 'antonym' },  // feliz ↔ triste
  { from: 'w181', to: 'w182', type: 'antonym' },  // ocupado ↔ libre
  { from: 'w110', to: 'w129', type: 'antonym' },  // recordar ↔ olvidar
  { from: 'w123', to: 'w124', type: 'antonym' },  // perder ↔ ganar
  { from: 'w125', to: 'w126', type: 'antonym' },  // dormir ↔ despertar
  { from: 'w101', to: 'w102', type: 'antonym' },  // empezar ↔ terminar
  { from: 'w120', to: 'w121', type: 'antonym' },  // salir ↔ volver

  // ── SYNONYMS (green) ────────────────────────────────────────────────────────
  { from: 'w051', to: 'w073', type: 'synonym' },  // bueno ↔ bien (good/well)
  { from: 'w009', to: 'w104', type: 'synonym' },  // saber ↔ conocer (both "to know")
  { from: 'w005', to: 'w018', type: 'synonym' },  // decir ↔ hablar (say/speak)
  { from: 'w103', to: 'w017', type: 'synonym' },  // pensar ↔ creer (think/believe)
  { from: 'w013', to: 'w108', type: 'synonym' },  // deber ↔ necesitar (must/need)
  { from: 'w092', to: 'w093', type: 'synonym' },  // para ↔ por (both "for")
  { from: 'w056', to: 'w058', type: 'synonym' },  // mucho ↔ tanto (much/so much)
  { from: 'w057', to: 'w082', type: 'synonym' },  // poco ↔ menos (little/less)
  { from: 'w016', to: 'w107', type: 'synonym' },  // quedar ↔ esperar (stay/wait)
  { from: 'w010', to: 'w108', type: 'synonym' },  // querer ↔ necesitar (want/need)
  { from: 'w106', to: 'w009', type: 'synonym' },  // entender ↔ saber (understand/know)
  { from: 'w175', to: 'w051', type: 'synonym' },  // bonito ↔ bueno (pretty/good)
  { from: 'w006', to: 'w113', type: 'synonym' },  // ir ↔ caminar (go/walk)
  { from: 'w197', to: 'w200', type: 'synonym' },  // nunca ↔ tampoco (never/neither)
  { from: 'w105', to: 'w022', type: 'synonym' },  // buscar ↔ encontrar (look for/find)

  // ── CATEGORY (blue) — same semantic type ────────────────────────────────────

  // Pronouns
  { from: 'w083', to: 'w084', type: 'category' }, // yo ↔ tú
  { from: 'w083', to: 'w087', type: 'category' }, // yo ↔ nosotros
  { from: 'w085', to: 'w086', type: 'category' }, // él ↔ ella
  { from: 'w085', to: 'w088', type: 'category' }, // él ↔ ellos
  { from: 'w086', to: 'w088', type: 'category' }, // ella ↔ ellos
  { from: 'w084', to: 'w087', type: 'category' }, // tú ↔ nosotros

  // People nouns
  { from: 'w035', to: 'w045', type: 'category' }, // hombre ↔ niño
  { from: 'w039', to: 'w045', type: 'category' }, // mujer ↔ niño
  { from: 'w035', to: 'w046', type: 'category' }, // hombre ↔ amigo
  { from: 'w039', to: 'w046', type: 'category' }, // mujer ↔ amigo

  // Time nouns
  { from: 'w031', to: 'w033', type: 'category' }, // año ↔ día
  { from: 'w031', to: 'w032', type: 'category' }, // año ↔ vez
  { from: 'w033', to: 'w038', type: 'category' }, // día ↔ tiempo
  { from: 'w078', to: 'w079', type: 'category' }, // ahora ↔ después
  { from: 'w080', to: 'w078', type: 'category' }, // siempre ↔ ahora
  { from: 'w075', to: 'w077', type: 'category' }, // ya ↔ entonces

  // Places (scale)
  { from: 'w040', to: 'w042', type: 'category' }, // casa ↔ ciudad
  { from: 'w042', to: 'w043', type: 'category' }, // ciudad ↔ país
  { from: 'w043', to: 'w049', type: 'category' }, // país ↔ mundo

  // Emotion adjectives
  { from: 'w067', to: 'w171', type: 'category' }, // feliz ↔ cansado
  { from: 'w173', to: 'w172', type: 'category' }, // triste ↔ enfermo
  { from: 'w067', to: 'w051', type: 'category' }, // feliz ↔ bueno

  // Core modal verbs
  { from: 'w004', to: 'w010', type: 'category' }, // poder ↔ querer
  { from: 'w004', to: 'w013', type: 'category' }, // poder ↔ deber
  { from: 'w010', to: 'w013', type: 'category' }, // querer ↔ deber
  { from: 'w013', to: 'w004', type: 'category' }, // deber ↔ poder

  // Eating verbs
  { from: 'w025', to: 'w026', type: 'category' }, // comer ↔ beber
  { from: 'w025', to: 'w119', type: 'category' }, // comer ↔ cocinar
  { from: 'w026', to: 'w119', type: 'category' }, // beber ↔ cocinar

  // Movement verbs
  { from: 'w006', to: 'w021', type: 'category' }, // ir ↔ seguir
  { from: 'w011', to: 'w012', type: 'category' }, // llegar ↔ pasar
  { from: 'w112', to: 'w113', type: 'category' }, // correr ↔ caminar
  { from: 'w120', to: 'w121', type: 'category' }, // salir ↔ volver

  // Reading/writing verbs
  { from: 'w028', to: 'w029', type: 'category' }, // leer ↔ escribir
  { from: 'w007', to: 'w114', type: 'category' }, // ver ↔ escuchar
  { from: 'w029', to: 'w163', type: 'category' }, // escribir ↔ carta

  // Verb/noun pairs (same root)
  { from: 'w023', to: 'w047', type: 'category' }, // trabajar ↔ trabajo
  { from: 'w024', to: 'w037', type: 'category' }, // vivir ↔ vida
  { from: 'w128', to: 'w156', type: 'category' }, // preguntar ↔ pregunta
  { from: 'w018', to: 'w155', type: 'category' }, // hablar ↔ lengua
  { from: 'w117', to: 'w154', type: 'category' }, // aprender ↔ clase
  { from: 'w029', to: 'w151', type: 'category' }, // escribir ↔ palabra

  // ── DOMAIN (purple, dashed) — same real-world topic ─────────────────────────

  // Food & eating
  { from: 'w025', to: 'w142', type: 'domain' },   // comer ↔ comida
  { from: 'w025', to: 'w044', type: 'domain' },   // comer ↔ agua
  { from: 'w026', to: 'w044', type: 'domain' },   // beber ↔ agua
  { from: 'w119', to: 'w142', type: 'domain' },   // cocinar ↔ comida
  { from: 'w142', to: 'w148', type: 'domain' },   // comida ↔ desayuno
  { from: 'w142', to: 'w149', type: 'domain' },   // comida ↔ cena
  { from: 'w147', to: 'w025', type: 'domain' },   // restaurante ↔ comer
  { from: 'w147', to: 'w142', type: 'domain' },   // restaurante ↔ comida
  { from: 'w170', to: 'w142', type: 'domain' },   // mercado ↔ comida

  // Education
  { from: 'w117', to: 'w118', type: 'domain' },   // aprender ↔ enseñar
  { from: 'w137', to: 'w117', type: 'domain' },   // escuela ↔ aprender
  { from: 'w137', to: 'w118', type: 'domain' },   // escuela ↔ enseñar
  { from: 'w131', to: 'w137', type: 'domain' },   // libro ↔ escuela
  { from: 'w154', to: 'w137', type: 'domain' },   // clase ↔ escuela
  { from: 'w155', to: 'w117', type: 'domain' },   // lengua ↔ aprender
  { from: 'w156', to: 'w157', type: 'domain' },   // pregunta ↔ respuesta
  { from: 'w118', to: 'w154', type: 'domain' },   // enseñar ↔ clase

  // Work & money
  { from: 'w023', to: 'w132', type: 'domain' },   // trabajar ↔ dinero
  { from: 'w047', to: 'w132', type: 'domain' },   // trabajo ↔ dinero
  { from: 'w027', to: 'w132', type: 'domain' },   // comprar ↔ dinero
  { from: 'w127', to: 'w132', type: 'domain' },   // pagar ↔ dinero
  { from: 'w162', to: 'w132', type: 'domain' },   // banco ↔ dinero
  { from: 'w124', to: 'w132', type: 'domain' },   // ganar ↔ dinero

  // Travel
  { from: 'w145', to: 'w166', type: 'domain' },   // viaje ↔ vuelo
  { from: 'w145', to: 'w144', type: 'domain' },   // viaje ↔ tren
  { from: 'w145', to: 'w143', type: 'domain' },   // viaje ↔ coche
  { from: 'w167', to: 'w166', type: 'domain' },   // aeropuerto ↔ vuelo
  { from: 'w146', to: 'w145', type: 'domain' },   // hotel ↔ viaje
  { from: 'w143', to: 'w144', type: 'domain' },   // coche ↔ tren

  // Health
  { from: 'w168', to: 'w169', type: 'domain' },   // médico ↔ hospital
  { from: 'w172', to: 'w169', type: 'domain' },   // enfermo ↔ hospital
  { from: 'w172', to: 'w168', type: 'domain' },   // enfermo ↔ médico
  { from: 'w171', to: 'w172', type: 'domain' },   // cansado ↔ enfermo

  // Home
  { from: 'w040', to: 'w158', type: 'domain' },   // casa ↔ puerta
  { from: 'w040', to: 'w159', type: 'domain' },   // casa ↔ habitación
  { from: 'w040', to: 'w160', type: 'domain' },   // casa ↔ jardín
  { from: 'w138', to: 'w040', type: 'domain' },   // mesa ↔ casa
  { from: 'w140', to: 'w040', type: 'domain' },   // cama ↔ casa
]

export { MANDARIN_RELATIONS as MANDARIN_RELATIONS_MAP } from './mandarin-relations'
