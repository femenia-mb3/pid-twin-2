import React, { useState, useEffect } from 'react';
import { X, Shield, KeyRound, CheckCircle2, Building, MapPin, AlertCircle } from 'lucide-react';
import { OperatorIdentity } from '../types/pilotOperations';
import { InstitutionalJwtClaims } from '../types/institutionalAuth';

interface InstitutionalAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionChanged?: (claims: InstitutionalJwtClaims) => void;
}

export const InstitutionalAuthModal: React.FC<InstitutionalAuthModalProps> = ({
  isOpen,
  onClose,
  onSessionChanged,
}) => {
  const [operators, setOperators] = useState<OperatorIdentity[]>([]);
  const [currentSession, setCurrentSession] = useState<{ operator: OperatorIdentity; tokenVerified: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setMessage(null);

    Promise.all([
      fetch('/api/auth/operators').then(res => res.json()),
      fetch('/api/auth/me').then(res => res.json())
    ])
      .then(([opsData, meData]) => {
        if (opsData?.operators) setOperators(opsData.operators);
        if (meData?.operator) {
          setCurrentSession({ operator: meData.operator, tokenVerified: meData.tokenVerified });
        }
      })
      .catch(err => console.error('Error cargando identidad:', err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleLogin = async (username: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username,
          apiKey: username === 'gestor_malaga' ? 'malaga_secure_token_2026' : username === 'gestor_palma' ? 'palma_secure_token_2026' : 'segittur_master_key_2026'
        })
      });

      if (!response.ok) {
        throw new Error('Fallo al iniciar sesión institucional.');
      }

      const data = await response.json();
      setCurrentSession({ operator: data.operator, tokenVerified: true });
      setMessage({ text: `Sesión autenticada con éxito como ${data.operator.displayName}. Token JWT generado (expira en 24h).`, type: 'success' });
      if (onSessionChanged && data.claims) {
        onSessionChanged(data.claims);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Error autenticando sesión.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Autenticación Institucional PID / SEGITTUR</h2>
              <p className="text-xs text-slate-500">Gestión de sesión abierta basada en Bearer JWT y control de claims territoriales</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Tarjeta de Sesión Activa */}
          {currentSession && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Sesión Activa Verificada (Token JWT HS256)
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Claims en Vigor
                </span>
              </div>
              <div className="flex items-start gap-3 pt-1">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                  {currentSession.operator.displayName.charAt(0)}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800">{currentSession.operator.displayName}</h3>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" /> {currentSession.operator.tenantName} ({currentSession.operator.tenantId})
                  </p>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Jurisdicción autorizada: <strong className="text-slate-800">{currentSession.operator.authorizedDestinations.join(', ')}</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Selector de Operadores Demostradores */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Conmutar Perfil de Operador Institucional (Demostrador Abierto)
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {operators.map(op => {
                const isSelected = currentSession?.operator.username === op.username;
                return (
                  <button
                    key={op.id}
                    onClick={() => {
                      handleLogin(op.username);
                    }}
                    disabled={loading}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected 
                        ? 'bg-blue-50/50 border-blue-500 shadow-sm ring-1 ring-blue-500/20' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{op.displayName}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                          {op.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{op.tenantName} · Destinos: <strong className="text-slate-700">{op.authorizedDestinations.join(', ')}</strong></p>
                    </div>
                    <div>
                      {isSelected ? (
                        <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Activo
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold hover:text-slate-600">
                          Acceder
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
            <strong>Gobernanza Territorial PID:</strong> Al autenticarse, las peticiones al motor de simulación, al editor de escenarios y al Agente IA viajan firmadas con Bearer JWT. El servidor verifica automáticamente que el operador posea claims válidos sobre el destino consultado, denegando accesos no autorizados con <code>403 Forbidden</code>.
          </div>

        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
