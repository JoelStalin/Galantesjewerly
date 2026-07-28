import fs from 'node:fs/promises';
const file = 'data/inventory-agent/review/antigravity-cluster-review.json';
const state = JSON.parse(await fs.readFile(file, 'utf8'));
const verified = [
  ['reviewed-cluster-0001', true, 0.95, 'Mismo anillo de oro rosa con morganita y halo de diamantes.'],
  ['reviewed-cluster-0016', true, 0.95, 'Misma cadena de oro con eslabones idénticos y cierres consistentes.'],
  ['reviewed-cluster-1124', true, 0.98, 'Misma mano con las mismas joyas y manicura.'],
  ['reviewed-cluster-0467', true, 0.95, 'Misma pulsera de cadena; coinciden broche, etiqueta y proporciones.'],
  ['reviewed-cluster-0458', false, 0.95, 'Los eslabones y el grosor de ambas cadenas son diferentes.'],
  ['reviewed-cluster-0764', true, 0.98, 'Misma cadena de oro en el mismo busto de exhibición.'],
  ['reviewed-cluster-0415', false, 0.98, 'Los diseños de los anillos son totalmente distintos.']
  ,['reviewed-cluster-0502', false, 0.98, 'Un anillo sello con ancla y una alianza dorada fina son productos distintos.']
  ,['reviewed-cluster-0894', false, 0.99, 'Dos collares distintos: uno con tréboles blancos y otro con motivos rojos.']
  ,['reviewed-cluster-0892', true, 0.98, 'Misma cadena de oro sobre el mismo busto de exhibición.']
  ,['reviewed-cluster-0807', false, 0.95, 'Las cadenas presentan grosores y diseños de eslabón diferentes.']
  ,['reviewed-cluster-0821', false, 0.95, 'Las cadenas tienen grosor y tamaño de eslabón diferentes.']
  ,['reviewed-cluster-0751', false, 0.95, 'Cadenas con diseños y grosores distintos: una entrelazada y otra lisa.']
  ,['reviewed-cluster-0386', false, 0.98, 'Anillos con distinto engaste y gemas de diferente corte y forma.']
  ,['reviewed-cluster-0379', false, 0.98, 'Un anillo con engaste central y una alianza lisa son productos distintos.']
  ,['reviewed-cluster-0472', true, 0.98, 'Misma cadena de oro con eslabón barbado, cierre de mosquetón y etiqueta blanca.']
  ,['reviewed-cluster-0414', false, 0.98, 'Anillos completamente distintos: sello con corona y banda con motivos de tornillos.']
  ,['reviewed-cluster-0768', false, 0.95, 'Las placas centrales de las pulseras tienen acabados diferentes.']
  ,['reviewed-cluster-0849', false, 0.9, 'Cadenas con distinto grosor y tejido; la etiqueta de inventario también difiere.']
  ,['reviewed-cluster-0831', false, 0.95, 'La cadena izquierda es visiblemente más gruesa que la derecha.']
  ,['reviewed-cluster-0316', false, 0.95, 'Los anillos muestran distinto grosor y anchura de banda.']
  ,['reviewed-cluster-0773', false, 0.99, 'Pulseras totalmente distintas: manos de Fátima frente a cadena con piedras rojas.']
];
const byId = new Map((state.reviews || []).map((item) => [item.clusterId, item]));
for (const [clusterId, sameProduct, confidence, reason] of verified) byId.set(clusterId, { clusterId, sameProduct, confidence, reason, source: 'google-ai-studio', restoredAt: new Date().toISOString() });
state.reviews = [...byId.values()];
state.completed = [...new Set([...state.completed, ...verified.map(([id]) => id)])];
await fs.writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, restored: verified.length, completed: state.completed.length, reviews: state.reviews.length }));
