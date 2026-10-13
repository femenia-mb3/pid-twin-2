import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  Archive
} from 'lucide-react';
import { IngestionDataLane } from '../types/dataIngestion';
import { DatasetFormat, IngestedDatasetRecord } from '../types/operationalConfiguration';

interface DataIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
  tenantId: string;
}

export const DataIngestionModal: React.FC<DataIngestionModalProps> = ({
  isOpen,
  onClose,
  destinationId,
  destinationName,
  tenantId,
}) => {
  const [lane, setLane] = useState<IngestionDataLane>('ONTOLOGICO_S2');
  const [fileFormat, setFileFormat] = useState<DatasetFormat>('CSV');
  const [title, setTitle] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [rawPayload, setRawPayload] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<IngestedDatasetRecord | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    if (!title) setTitle(`Carga de ${file.name.replace(/\.[^/.]+$/, '')}`);
    
    if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
      setFileFormat(file.name.endsWith('.geojson') ? 'GEOJSON' : 'JSON');
      const reader = new FileReader();
      reader.onload = (event) => {
        setRawPayload(event.target?.result as string);
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.zip')) {
      setFileFormat('SHP_ZIP');
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        setRawPayload(btoa(binary)); // Codificar base64 para envío seguro JSON
      };
      reader.readAsArrayBuffer(file);
    } else {
      setFileFormat('CSV');
      const reader = new FileReader();
      reader.onload = (event) => {
        setRawPayload(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const loadExampleData = () => {
    if (lane === 'ONTOLOGICO_S2') {
      setTitle('Inventario Municipal de Recursos y Miradores');
      setSourceName('Área de Turismo y Patrimonio');
      setFileFormat('CSV');
      setFileName('recursos_turisticos_nuevos.csv');
      setRawPayload(
        `nombre,categoria,latitud,longitud,aforo\n` +
        `Mirador de Gibralfaro Este,MIRADOR,36.7235,-4.4090,300\n` +
        `Centro de Interpretación del Puerto,MUSEO,36.7165,-4.4160,450\n` +
        `Plaza de la Merced Norte,ESPACIO_PUBLICO,36.7260,-4.4180,1200`
      );
    } else {
      setTitle('Aforos de Paso en Pasarela Peatonal');
      setSourceName('Red de Sensores Urbanos');
      setFileFormat('CSV');
      setFileName('telemetria_aforos_horarios.csv');
      setRawPayload(
        `sensorId,timestamp,valor,unidad\n` +
        `sensor_puerto_01,2026-10-08T12:00:00Z,380,conteo_personas\n` +
        `sensor_puerto_01,2026-10-08T13:00:00Z,520,conteo_personas\n` +
        `sensor_puerto_01,2026-10-08T14:00:00Z,460,conteo_personas`
      );
    }
  };

  const handleSubmit = async () => {
    if (!title || !rawPayload) {
      setError('Por favor indica un título y proporciona los datos.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/ingestion/datasets/file?destino=${destinationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: title,
          format: fileFormat,
          fileName: fileName || `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${fileFormat.toLowerCase()}`,
          rawPayload,
          lane: lane === 'ONTOLOGICO_S2' ? 'ONTOLOGICO' : 'NO_ONTOLOGICO_HISTORICO'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (data.validationReport?.errors && data.validationReport.errors.join(', ')) || 'Error durante la ingestión.');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error de conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-700 flex items-center justify-center font-bold">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Iteración 11 · Ingestión No-Code</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">{destinationName}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Alimentar Datos Propios al Gemelo</h2>
              <p className="text-xs text-slate-500">Soporte CSV, GeoJSON, JSON y Shapefile (ZIP) con CRS, validación y persistencia PostGIS</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Selección de carril PID */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLane('ONTOLOGICO_S2')}
              className={`p-3 rounded-xl border text-left transition-all ${
                lane === 'ONTOLOGICO_S2'
                  ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-800 mb-1">
                <Database className="w-4 h-4 text-violet-600" />
                Carril Ontológico PID (S2)
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Activos y recursos turísticos estructurados con geolocalización, categoría y aforos.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setLane('HISTORICO_C4')}
              className={`p-3 rounded-xl border text-left transition-all ${
                lane === 'HISTORICO_C4'
                  ? 'border-cyan-600 bg-cyan-50/50 ring-2 ring-cyan-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-800 mb-1">
                <Layers className="w-4 h-4 text-cyan-600" />
                Carril Histórico y Sensores (C4)
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Series temporales, telemetría IoT, conteos de paso y datos operacionales.
              </p>
            </button>
          </div>

          {/* Formulario */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Título del Dataset / Ingesta *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Conteos peatonales Calle Larios Octubre 2026"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-violet-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Formato de Archivo</label>
                <select
                  value={fileFormat}
                  onChange={(e) => setFileFormat(e.target.value as DatasetFormat)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-violet-600 bg-white"
                >
                  <option value="CSV">CSV Tabular (.csv)</option>
                  <option value="GEOJSON">GeoJSON Cartográfico (.geojson)</option>
                  <option value="JSON">JSON Estructurado (.json)</option>
                  <option value="SHP_ZIP">Shapefile Comprimido (.zip con .shp + .dbf)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Fuente / Plataforma Emisora</label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="Ej. Red LoRaWAN Municipal"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-violet-600"
                />
              </div>
            </div>

            {/* Zona de subida o carga de ejemplo */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Subir archivo o pegar datos *</label>
                <button
                  type="button"
                  onClick={loadExampleData}
                  className="text-[11px] text-violet-700 font-bold hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Cargar plantilla de prueba
                </button>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/50 flex flex-col items-center justify-center gap-2 mb-2">
                <input
                  type="file"
                  id="file-upload"
                  accept=".csv,.geojson,.json,.zip"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-violet-600" />
                  Seleccionar archivo (.csv, .geojson, .json, .zip)
                </label>
                {fileName && (
                  <span className="text-[11px] text-slate-600 flex items-center gap-1 font-mono">
                    <FileText className="w-3 h-3 text-slate-400" /> {fileName}
                  </span>
                )}
              </div>

              {fileFormat !== 'SHP_ZIP' && (
                <textarea
                  rows={4}
                  value={rawPayload}
                  onChange={(e) => setRawPayload(e.target.value)}
                  placeholder="Pega aquí los datos en formato CSV o GeoJSON..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-violet-600 font-mono"
                />
              )}
            </div>
          </div>

          {/* Errores */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Resultado de la ingestión */}
          {result && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Dataset ingestada y persistido en PostGIS con éxito</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-[11px] bg-white p-3 rounded-lg border border-emerald-100">
                <div>
                  <span className="text-slate-400 block">Total registros:</span>
                  <span className="font-bold text-slate-800 font-mono">{result.totalRecords}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">CRS detectado:</span>
                  <span className="font-bold text-slate-800 font-mono">{result.detectedCrs}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Geometría:</span>
                  <span className="font-bold text-slate-800 font-mono">{result.geometryType || 'None'}</span>
                </div>
              </div>

              <div className="text-[10px] text-emerald-900 bg-emerald-100/60 p-2 rounded flex items-center justify-between font-mono">
                <span>Huella SHA-256: {result.fingerprintSha256.slice(0, 24)}...</span>
                <span className="font-bold text-violet-700">Estado: {result.status}</span>
              </div>
            </div>
          )}

        </div>

        {/* Pie */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Archive className="w-3.5 h-3.5 text-slate-400" /> Los datos quedan aislados por tenant y vinculables a modelos.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={isSubmitting || !title || !rawPayload}
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-violet-700 text-white rounded-xl text-xs font-bold hover:bg-violet-800 shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Procesando...' : 'Ingestar y Guardar'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
