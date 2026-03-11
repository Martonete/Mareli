/**
 * Premios por defecto para la tienda de puntos.
 * Fuente única de verdad - usada tanto para mock como para sync.
 */
export const DEFAULT_REWARDS = [
  { name: 'Elegir la película/serie', points_cost: 20 },
  { name: 'Merienda', points_cost: 25 },
  { name: 'Elegís la música todo el día', points_cost: 30 },
  { name: 'Desayuno en la cama', points_cost: 35 },
  { name: 'Postre sorpresa', points_cost: 35 },
  { name: 'Paseo sorpresa', points_cost: 50 },
  { name: 'Noche de cine', points_cost: 60 },
  { name: 'Noche de bar / tragos', points_cost: 80 },
  { name: 'Masajes', points_cost: 90 },
  { name: 'Oral', points_cost: 110 },
  { name: 'Soy tu esclavo/a', points_cost: 160 },
] as const;
