import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, Loader2, ShieldCheck, Upload, X } from 'lucide-react';
import { ContextPackageImportResult, ContextPackageV1, ContextPackageValidationReport } from '../types/contextPackage';

interface ContextPackageModalProps {
  onClose: () => void;
  onImported: (contextPackage: ContextPackageV1) => void;
}

type ModalState = 'INICIAL' | 'VALIDANDO' | 'VALIDADO' | 'IMPORTANDO' | 'IMPORTADO' | 'ERROR';

const readResponse = async <T,>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('La API no devolvió una respuesta JSON válida.');
  return response.json() as Promise<T>;
};

const isImportResult = (value: unknown): value is ContextPackageImportResult => value !== null
  && typeof value === 'object'
  && 'type' in value
  && (value as { type?: string }).type === 'ContextPackageImportResult';

export const ContextPackageModal = ({ onClose, onImported }: ContextPackageModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<unknown>(null);
  const [sourceName, setSourceName] = useState<string>('');
  const [report, setReport] = useState<ContextPackageValidationReport | null>(null);
  const [status, setStatus] = useState<ModalState>('INICIAL');
  const [message, setMessage] = useState<string>('');

  const summary = useMemo(() => report?.summary || { zones: 0, resources: 0, sensors: 0, sources: 0, variables: 0 }, [report]);
  const isReady = Boolean(candidate && report?.valid && status === 'VALIDADO');

  const prevalidate = async (nextCandidate: unknown, label: string) => {
    setCandidate(nextCandidate);
    setSourceName(label);
    setMessage('');
    setStatus('VALIDANDO');
    setReport(null);
    try {
      const response = await fetch('/api/context-packages/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextCandidate),
      });
      const result = await readResponse<{ report: ContextPackageValidationReport }>(response);
      setReport(result.report);
      setStatus(result.report.valid ? 'VALIDADO' : 'ERROR');
      if (!result.report.valid) setMessage('El paquete tiene errores bloqueantes. Corrígelos antes de importarlo.');
    } catch (error) {
      setStatus('ERROR');
      setMessage(error instanceof Error ? error.message : 'No se ha podido validar el ContextPackage.');
    }
  };

  const loadExample = async () => {
    setStatus('VALIDANDO');
    setMessage('');
    try {
      const response = await fetch('/context-packages/context-package-v1-destino-demostrador.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar el paquete demostrador.');
      const example = await response.json();
      await prevalidate(example, 'Paquete demostrador sintético ContextPackage v1');
    } catch (error) {
      setStatus('ERROR');
      setMessage(error instanceof Error ? error.message : 'No se ha podido cargar el ejemplo.');
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage('');
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      await prevalidate(parsed, file.name);
    } catch {
      setCandidate(null);
      setReport(null);
      setStatus('ERROR');
      setMessage('El archivo seleccionado no contiene JSON válido.');
    } finally {
      event.target.value = '';
    }
  };

  const importPackage = async () => {
    if (!candidate || !report?.valid) return;
    setStatus('IMPORTANDO');
    setMessage('');
    try {
      const response = await fetch('/api/context-packages/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });
      const result = await readResponse<ContextPackageImportResult | { report: ContextPackageValidationReport }>(response);
      if (!response.ok || !isImportResult(result)) {
        const rejected = result as { report?: ContextPackageValidationReport };
        if (rejected.report) setReport(rejected.report);
        setStatus('ERROR');
        setMessage('La importación fue rechazada. Revisa los errores de validación.');
        return;
      }
      onImported(result.package);
      setReport(result.report);
      setStatus('IMPORTADO');
      setMessage('Destino incorporado a la sesión. La persistencia PostGIS se activa en el piloto persistente mediante la migración 005.');
    } catch (error) {
      setStatus('ERROR');
      setMessage(error instanceof Error ? error.message : 'No se ha podido importar el ContextPackage.');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Alta de destino mediante ContextPackage">
      <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-cyan-50 via-white to-violet-50 px-6 py-5">
          <div className="pr-6">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">
              <FileJson className="h-4 w-4" /> ContextPackage v1
            </div>
            <h2 className="text-xl font-bold text-slate-900">Alta de un nuevo destino</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Valida el perfil, las entidades, las fuentes, las variables, el mapeo semántico y la evidencia antes de incorporar el destino al gemelo.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-900" aria-label="Cerrar alta de destino">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid flex-1 overflow-y-auto md:grid-cols-[1fr_1.15fr]">
          <div className="border-b border-slate-200 p-6 md:border-b-0 md:border-r">
            <h3 className="text-sm font-bold text-slate-800">1. Selecciona un paquete</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">El ejemplo permite recorrer el flujo completo con información ficticia. También puedes cargar un archivo JSON propio conforme al estándar.</p>

            <button type="button" onClick={loadExample} disabled={status === 'VALIDANDO' || status === 'IMPORTANDO'} className="mt-5 flex w-full items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-left transition-colors hover:border-cyan-400 hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60">
              <span className="rounded-lg bg-white p-2 text-cyan-700 shadow-sm"><FileJson className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-bold text-slate-800">Cargar ejemplo demostrador</span>
                <span className="block text-xs text-slate-600">Destino ficticio · 2 zonas · 1 recurso · 1 sensor</span>
              </span>
            </button>

            <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={status === 'VALIDANDO' || status === 'IMPORTANDO'} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left transition-colors hover:border-slate-500 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-700"><Upload className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-bold text-slate-800">Cargar JSON propio</span>
                <span className="block text-xs text-slate-500">No se envía ninguna credencial ni fichero de datos masivo.</span>
              </span>
            </button>

            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
              <div className="mb-1 flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> Gobierno antes de importación</div>
              Se validan CRS, geometrías, capacidad, trazabilidad, calidad, privacidad, autorización de fuentes y referencias semánticas. Las advertencias no convierten datos demostradores en datos reales.
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">2. Resultado de validación</h3>
                <p className="mt-1 text-xs text-slate-500">{sourceName || 'Aún no se ha seleccionado un paquete.'}</p>
              </div>
              {status === 'VALIDANDO' || status === 'IMPORTANDO' ? <Loader2 className="h-5 w-5 animate-spin text-cyan-600" /> : null}
            </div>

            {report ? (
              <>
                <div className={`mt-4 rounded-xl border p-4 ${report.valid ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                  <div className="flex items-start gap-3">
                    {report.valid ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />}
                    <div>
                      <p className={`text-sm font-bold ${report.valid ? 'text-emerald-900' : 'text-rose-900'}`}>{report.valid ? 'Paquete válido para importación' : 'Paquete rechazado'}</p>
                      <p className={`mt-0.5 text-xs ${report.valid ? 'text-emerald-800' : 'text-rose-800'}`}>{report.valid ? 'La importación habilitará el destino solo durante la sesión de demostración.' : 'Corrige los errores obligatorios para continuar.'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-2">
                  {[[summary.zones, 'Zonas'], [summary.resources, 'Recursos'], [summary.sensors, 'Sensores'], [summary.sources, 'Fuentes'], [summary.variables, 'Variables']].map(([value, label]) => (
                    <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                      <span className="block text-base font-bold text-slate-800">{value}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                    </div>
                  ))}
                </div>

                {report.errors.length > 0 && (
                  <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3">
                    <p className="mb-2 text-xs font-bold text-rose-900">Errores bloqueantes</p>
                    <ul className="space-y-1.5 text-xs text-rose-800">{report.errors.map(error => <li key={`${error.code}-${error.path}`}><span className="font-mono text-[10px]">{error.path}</span> · {error.message}</li>)}</ul>
                  </div>
                )}

                {report.warnings.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3">
                    <p className="mb-2 text-xs font-bold text-amber-900">Advertencias a resolver antes de producción</p>
                    <ul className="space-y-1.5 text-xs text-amber-900">{report.warnings.map(warning => <li key={`${warning.code}-${warning.path}`}><span className="font-mono text-[10px]">{warning.path}</span> · {warning.message}</li>)}</ul>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Carga un ejemplo o un archivo JSON para iniciar la validación.</div>
            )}

            {message && <p className={`mt-4 text-xs font-medium ${status === 'IMPORTADO' ? 'text-emerald-700' : 'text-rose-700'}`}>{message}</p>}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="max-w-xl text-[11px] leading-relaxed text-slate-500">En esta demo, la importación se conserva solo en memoria. La migración PostGIS 005 deja preparada la persistencia con tenant, destino y RLS.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">Cerrar</button>
            <button type="button" onClick={importPackage} disabled={!isReady} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300">
              {status === 'IMPORTANDO' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {status === 'IMPORTADO' ? 'Destino incorporado' : 'Importar al gemelo'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
