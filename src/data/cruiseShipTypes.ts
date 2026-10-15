// Tipos de crucero que el usuario puede combinar en el Escenario 1 (capacidad = pasajeros a plena ocupación).
export interface TipoCrucero {
  id: string;
  nombre: string;
  modelo: string;
  capacidad: number;
}

export const TIPOS_CRUCERO: TipoCrucero[] = [
  { id: 'boutique', nombre: 'Crucero boutique', modelo: 'Seabourn Ovation', capacidad: 600 },
  { id: 'pequeno', nombre: 'Crucero pequeño', modelo: 'Celebrity Silhouette', capacidad: 2800 },
  { id: 'mediano', nombre: 'Crucero mediano', modelo: 'MSC Musica', capacidad: 3200 },
  { id: 'grande', nombre: 'Crucero grande', modelo: 'Costa Smeralda', capacidad: 6600 },
  { id: 'mega', nombre: 'Megacrucero', modelo: 'MSC World Europa', capacidad: 6760 },
  { id: 'clase-oasis', nombre: 'Clase Oasis', modelo: 'Wonder of the Seas', capacidad: 7000 },
];

// Estimación de pasajeros a partir de la eslora (m) cuando el AIS no informa de la capacidad.
export const capacidadPorEslora = (esloraM: number): number => Math.max(100, Math.round((esloraM * esloraM) / 30 / 50) * 50);
