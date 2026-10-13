export interface SyntheticForecastPoint {
  hora: string;
  prediccion: number;
  observado: number;
  limiteInferior: number;
  limiteSuperior: number;
}

export interface SyntheticForecastExperiment {
  etiquetaDatos: 'SINTÉTICOS · DEMO';
  modeloVersion: string;
  horizonte: string;
  prediccionT4: number;
  observadoT4: number;
  errorPctT4: number;
  mape: number;
  sesgo: number;
  confianzaPct: number;
  series: SyntheticForecastPoint[];
  playbook: {
    id: string;
    estado: 'PROPUESTO' | 'EN_OBSERVACIÓN';
    disparador: string;
    pasos: string[];
  };
}

const profile = [0.31, 0.36, 0.44, 0.56, 0.67, 0.78, 0.86, 0.91, 0.84, 0.72, 0.58, 0.43];
const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

const hashSeed = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// Oscilación estable: al variar el contexto o los parámetros, cambia la serie sin presentar azar como dato real.
const deterministicNoise = (index: number, seed: number) => {
  const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 2;
};

export const generateSyntheticForecastExperiment = ({
  contextFingerprint,
  modelVersion,
  baselineVisitors,
  scenarioFactor,
  manualVariation,
  climate,
  saturation,
  alertThreshold,
}: {
  contextFingerprint: string;
  modelVersion: string;
  baselineVisitors: number;
  scenarioFactor: number;
  manualVariation: number;
  climate: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
  saturation: number;
  alertThreshold: number;
}): SyntheticForecastExperiment => {
  const destinationBase = Math.max(500, Math.round(baselineVisitors * 1.85));
  const climateFactor = climate === 'LLUVIA' ? 0.87 : climate === 'CALOR_EXTREMO' ? 1.08 : 1;
  const scenarioMultiplier = scenarioFactor * (1 + manualVariation / 100) * climateFactor;
  const seed = hashSeed(contextFingerprint);

  const series = profile.map((weight, index) => {
    const expected = Math.round(destinationBase * weight * scenarioMultiplier);
    const predictorNoise = deterministicNoise(index, seed) * 0.028;
    const observedNoise = deterministicNoise(index + 17, seed + 5) * 0.075;
    const prediccion = Math.round(expected * (1 + predictorNoise));
    const observado = Math.round(expected * (1 + observedNoise));
    const interval = Math.max(260, Math.round(prediccion * 0.09));
    return { hora: hours[index], prediccion, observado, limiteInferior: prediccion - interval, limiteSuperior: prediccion + interval };
  });

  const comparisonIndex = 7;
  const prediccionT4 = series[comparisonIndex].prediccion;
  const observadoT4 = series[comparisonIndex].observado;
  const errors = series.map(point => Math.abs(point.prediccion - point.observado) / Math.max(point.observado, 1));
  const signedErrors = series.map(point => (point.prediccion - point.observado) / Math.max(point.observado, 1));
  const errorPctT4 = Number((Math.abs(prediccionT4 - observadoT4) / observadoT4 * 100).toFixed(1));
  const mape = Number((errors.reduce((sum, value) => sum + value, 0) / errors.length * 100).toFixed(1));
  const sesgo = Number((signedErrors.reduce((sum, value) => sum + value, 0) / signedErrors.length * 100).toFixed(1));
  const playbookRequired = saturation >= alertThreshold;

  return {
    etiquetaDatos: 'SINTÉTICOS · DEMO',
    modeloVersion: modelVersion,
    horizonte: 'T+4 h',
    prediccionT4,
    observadoT4,
    errorPctT4,
    mape,
    sesgo,
    confianzaPct: 91,
    series,
    playbook: {
      id: playbookRequired ? 'PB-SAT-01' : 'PB-MON-01',
      estado: playbookRequired ? 'PROPUESTO' : 'EN_OBSERVACIÓN',
      disparador: playbookRequired
        ? `Saturación simulada ${saturation}% ≥ umbral ${alertThreshold}%`
        : `Saturación simulada ${saturation}% bajo umbral ${alertThreshold}%`,
      pasos: playbookRequired
        ? ['Validar con fuentes IoT agregadas', 'Proponer desvío y señalización', 'Notificar al operador responsable', 'Medir reducción de presión']
        : ['Mantener observación de sensores', 'Revisar siguiente horizonte T+4', 'Registrar resultado para calibración'],
    },
  };
};
