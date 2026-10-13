import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { leyendaFlujoSimulacion } from '../services/simulationFlowLegend';
import { RUTAS_CRUCERO_VIARIAS, RUTAS_EVENTO_VIARIAS } from '../data/rutasCruceroViarias';
import { ZonaDestino, RecursoTuristico, SensorIoT } from '../types/ontology';
import { FlujoModelo, leyendaFlujosModelo } from '../services/modelFlows';
import { HEATMAP_GRADIENT_CSS, HEATMAP_LABELS, sensorIconSvg, sensorVisual, TipoMapaCalor } from '../services/sensorVisuals';
import { KpiMapa, KPI_MAPA_CONFIG, clasesLeyenda, textoClase, oscurecer, valoresKpiEdificio, centroideGeoJSON, modelosKpiCacheados, coloresKpiEdificios, precalentarKpis, PuntoEdificio } from '../services/kpiBuildingColors';

export interface MapViewerProps {
  centro: [number, number];
  zoom: number;
  zonas: (ZonaDestino & { capacidadCargaSimuladaPct?: number; afluenciaSimulada?: number; nivelRiesgo?: string })[];
  recursos: (RecursoTuristico & { visitantesSimuladosHora?: number; ocupacionSimuladaPct?: number })[];
  sensores: (SensorIoT & { valorSimulado?: number; estadoSimulado?: string })[];
  capasActivas: {
    zonas: boolean;
    calor: boolean;
    recursos: boolean;
    sensores: boolean;
    rutas: boolean;
  };
  tipoMapaCalor: TipoMapaCalor;
  kpiMapa?: KpiMapa | null;
  simulacionVisual: {
    escenarioId: string;
    escenarioNombre: string;
    hora: number;
    intensidad: number;
    flujos?: FlujoModelo[];
  };
  rutasDesvio: {
    origen: string;
    destino: string;
    coordenadasRuta: [number, number][];
    capacidadDesvioHora: number;
    descripcion: string;
  }[];
  nivelVisualizacion: 1 | 2 | 3;
  cartografiaBase?: {
    edificiosUrl: string;
    relieveUrl: string;
    relieveBounds: [[number, number], [number, number]];
    edificiosEsperados: number;
    etiquetaRelieve: string;
  };
  onSelectElement: (elemento: any) => void;
  onBaseClick?: () => void;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  centro,
  zoom,
  zonas,
  recursos,
  sensores,
  capasActivas,
  tipoMapaCalor,
  kpiMapa,
  simulacionVisual,
  rutasDesvio,
  nivelVisualizacion,
  cartografiaBase,
  onSelectElement,
  onBaseClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [zonasInundacion, setZonasInundacion] = useState<{ features: any[] } | null>(null);
  const lluviaActiva = simulacionVisual.escenarioId === 'episodio_meteo' && simulacionVisual.intensidad >= 0.04;
  useEffect(() => {
    if (!lluviaActiva || zonasInundacion) return;
    let cancelado = false;
    fetch('/data/malaga/malaga-zonas-inundacion.geojson')
      .then(r => (r.ok ? r.json() : null))
      .then(datos => { if (!cancelado && datos?.features) setZonasInundacion(datos); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [lluviaActiva, zonasInundacion]);

  const mapInstanceRef = useRef<any>(null);
  const layersGroupRef = useRef<any>({});
  const [edificiosCatastro, setEdificiosCatastro] = useState<any>(null);
  const [estadoCartografia, setEstadoCartografia] = useState<'inactiva' | 'cargando' | 'lista' | 'error'>('inactiva');
  const onBaseClickRef = useRef(onBaseClick);
  onBaseClickRef.current = onBaseClick;

  // 1. Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true
      }).setView(centro, zoom);

      // Cartografía oficial abierta del IGN/CNIG, servida mediante TMS.
      L.tileLayer('https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{y}.jpeg', {
        maxZoom: 20,
        maxNativeZoom: 17,
        tms: true,
        attribution: 'CC-BY 4.0 Instituto Geográfico Nacional'
      }).addTo(map);

      // Zoom control en esquina superior derecha
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Mantener las huellas catastrales legibles por encima del mapa de calor.
      map.createPane('edificiosCatastroPane');
      const edificiosPane = map.getPane('edificiosCatastroPane');
      if (edificiosPane) edificiosPane.style.zIndex = '430';

      // Clic sobre el mapa base (incluye huellas catastrales, que propagan el evento).
      map.on('click', () => onBaseClickRef.current?.());

      mapInstanceRef.current = map;
      layersGroupRef.current = {
        relieve: L.layerGroup().addTo(map),
        edificios25D: L.layerGroup().addTo(map),
        zonas: L.layerGroup().addTo(map),
        calor: L.layerGroup().addTo(map),
        recursos: L.layerGroup().addTo(map),
        sensores: L.layerGroup().addTo(map),
        rutas: L.layerGroup().addTo(map),
        simulacion: L.layerGroup().addTo(map)
      };
    }

    return () => {
      // Cleanup si se desmonta
    };
  }, []);

  // 2. Recentrar mapa cuando cambia destino
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(centro, zoom, { animate: true });
    }
  }, [centro, zoom]);

  // Encuadrar la cobertura real para no heredar el centro/zoom de los polígonos de demostración.
  useEffect(() => {
    if (mapInstanceRef.current && cartografiaBase) {
      mapInstanceRef.current.fitBounds(cartografiaBase.relieveBounds, {
        padding: [28, 28],
        animate: true
      });
    }
  }, [cartografiaBase]);

  // 3. Cargar una sola vez las piezas reales de Catastro para el destino activo.
  useEffect(() => {
    if (!cartografiaBase?.edificiosUrl) {
      setEstadoCartografia('inactiva');
      setEdificiosCatastro(null);
      return;
    }

    const controller = new AbortController();
    setEstadoCartografia('cargando');

    fetch(cartografiaBase.edificiosUrl, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Catastro HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        setEdificiosCatastro(data);
        setEstadoCartografia('lista');
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('No se pudo cargar la cartografía catastral', error);
          setEstadoCartografia('error');
        }
      });

    return () => controller.abort();
  }, [cartografiaBase?.edificiosUrl]);

  // 4. Renderizar capas geoespaciales
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const {
      relieve: gRelieve,
      zonas: gZonas,
      calor: gCalor,
      recursos: gRecursos,
      sensores: gSensores,
      rutas: gRutas,
      simulacion: gSimulacion
    } = layersGroupRef.current;

    // Limpiar capas previas
    gRelieve.clearLayers();
    gZonas.clearLayers();
    gCalor.clearLayers();
    gRecursos.clearLayers();
    gSensores.clearLayers();
    gRutas.clearLayers();
    gSimulacion.clearLayers();

    // CARTOGRAFÍA BASE REAL: MDT50 de PNOA y piezas de edificios INSPIRE Catastro.
    if (cartografiaBase) {
      if (nivelVisualizacion >= 2) {
        L.imageOverlay(cartografiaBase.relieveUrl, cartografiaBase.relieveBounds, {
          opacity: 0.42,
          interactive: false,
          className: 'mdt-hillshade-overlay'
        }).addTo(gRelieve);
      }

    }

    // A) CAPA ZONAS / POLÍGONOS DE CAPACIDAD DE CARGA
    // Las zonas de capacidad solo pertenecen a la vista de afluencia. No deben
    // confundirse con la superficie interpolada de una variable ambiental.
    if (capasActivas.zonas && tipoMapaCalor === 'afluencia' && !cartografiaBase) {
      zonas.forEach(z => {
        const pct = z.capacidadCargaSimuladaPct !== undefined ? z.capacidadCargaSimuladaPct : z.capacidadCargaPct;
        
        let fillColor = '#10B981'; // Verde < 65%
        let borderColor = '#34D399';
        if (pct >= 90) {
          fillColor = '#EF4444'; // Rojo crítico
          borderColor = '#F87171';
        } else if (pct >= 75) {
          fillColor = '#F59E0B'; // Ámbar
          borderColor = '#FBBF24';
        }

        const polygon = L.polygon(z.coordenadasPoligono, {
          color: borderColor,
          weight: 2,
          fillColor: fillColor,
          fillOpacity: capasActivas.calor ? 0.35 : 0.20,
          dashArray: pct >= 90 ? '4, 4' : undefined
        });

        polygon.on('click', () => onSelectElement({ tipo: 'ZONA', data: z }));

        // Tooltip hover
        polygon.bindTooltip(
          `<strong>${z.nombre}</strong><br/>Ocupación: <b>${pct}%</b> (${(z.afluenciaSimulada || z.afluenciaActual).toLocaleString()} pers.)`,
          { sticky: true, className: 'leaflet-light-tooltip' }
        );

        gZonas.addLayer(polygon);

      });
    }

    // B) MAPA DE CALOR CONTINUO: afluencia o variables ambientales simuladas.
    if (capasActivas.calor) {
      let puntosCalor: [number, number, number][] = [];
      if (tipoMapaCalor === 'afluencia') {
        // Los puntos se sitúan en las cámaras de aforo; su % de ocupación simulado sube con el escenario y sus parámetros.
        puntosCalor = sensores.filter(sensor => sensor.tipoSensor === 'CAMARA_AFORO').map(sensor => {
          const ocupacion = sensor.valorSimulado ?? sensor.valorActual;
          // Curva exagerada: la ocupación alta (>100%) satura el rojo y la baja se queda en verde.
          const t = Math.min(1, Math.max(0, (ocupacion - 60) / 55));
          return [sensor.ubicacion[0], sensor.ubicacion[1], 0.25 + 0.75 * Math.pow(t, 1.4)];
        });
      } else {
        const sensorType = tipoMapaCalor === 'ruido' ? 'RUIDO_DB'
          : tipoMapaCalor === 'temperatura' ? 'TEMPERATURA_C'
          : 'CALIDAD_AIRE_NO2';
        puntosCalor = sensores.filter(sensor => sensor.tipoSensor === sensorType).map(sensor => {
          const value = sensor.valorSimulado ?? sensor.valorActual;
          const intensity = tipoMapaCalor === 'ruido' ? (value - 45) / 35
            : tipoMapaCalor === 'temperatura' ? (value - 18) / 20
            : value / 60;
          return [sensor.ubicacion[0], sensor.ubicacion[1], Math.min(1, Math.max(0.18, intensity))];
        });
      }

      const gradients: Record<TipoMapaCalor, Record<number, string>> = {
        afluencia: { 0.20: '#22c55e', 0.45: '#84cc16', 0.65: '#f59e0b', 0.80: '#ea580c', 1.00: '#dc2626' },
        ruido: { 0.20: '#c4b5fd', 0.45: '#8b5cf6', 0.70: '#d946ef', 1.00: '#be123c' },
        temperatura: { 0.20: '#38bdf8', 0.48: '#facc15', 0.72: '#f97316', 1.00: '#dc2626' },
        calidad_aire: { 0.20: '#22c55e', 0.48: '#a3e635', 0.72: '#f59e0b', 1.00: '#7e22ce' },
      };

      if (puntosCalor.length > 0) gCalor.addLayer(L.heatLayer(puntosCalor, {
        // Radios contenidos evitan sectores recortados cuando un punto queda
        // cerca del borde durante una transición de zoom de Leaflet.
        radius: tipoMapaCalor === 'afluencia' ? 72 : 58,
        blur: tipoMapaCalor === 'afluencia' ? 46 : 40,
        minOpacity: tipoMapaCalor === 'afluencia' ? 0.4 : 0.24,
        // leaflet.heat atenúa la intensidad al alejar el zoom respecto a maxZoom; con 12 el color
        // de afluencia se mantiene a los zooms de trabajo en lugar de verse siempre verde claro.
        maxZoom: tipoMapaCalor === 'afluencia' ? 12 : 19,
        gradient: gradients[tipoMapaCalor]
      }));
    }

    // C) CAPA RECURSOS TURÍSTICOS (POIs)
    if (capasActivas.recursos) {
      recursos.forEach(r => {
        const iconHtml = `
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-red-500 shadow-lg text-slate-800 font-bold text-xs cursor-pointer hover:scale-110 transition-transform">
            ${r.categoria === 'MUSEO' ? '🏛️' : r.categoria === 'MONUMENTO' ? '🏰' : r.categoria === 'PLAYA' ? '🏖️' : '📍'}
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-poi-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker(r.ubicacion, { icon: customIcon });
        marker.on('click', () => onSelectElement({ tipo: 'RECURSO', data: r }));
        marker.bindTooltip(
          `<b>${r.nombre}</b><br/>${r.categoria} • ${r.visitantesSimuladosHora || r.visitantesHora} vis/h`,
          { sticky: true }
        );
        gRecursos.addLayer(marker);
      });
    }

    // D) CAPA SENSORES IOT
    if (capasActivas.sensores) {
      const sensorTypeSeleccionado = tipoMapaCalor === 'ruido' ? 'RUIDO_DB'
        : tipoMapaCalor === 'temperatura' ? 'TEMPERATURA_C'
        : tipoMapaCalor === 'calidad_aire' ? 'CALIDAD_AIRE_NO2'
        : null;
      const sensoresVisibles = sensorTypeSeleccionado
        ? sensores.filter(sensor => sensor.tipoSensor === sensorTypeSeleccionado)
        : sensores;

      sensoresVisibles.forEach(s => {
        const estado = s.estadoSimulado || s.estado;
        const valor = s.valorSimulado !== undefined ? s.valorSimulado : s.valorActual;
        const visual = sensorVisual(s);
        const alertColor = estado === 'CRITICO' ? '#ef4444' : estado === 'PRECAUCION' ? '#f59e0b' : visual.color;

        const iconHtml = `
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-white border-2 shadow-md" style="border-color:${alertColor}">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-35" style="background-color: ${visual.color}"></span>
            <span class="relative inline-flex">${sensorIconSvg(s.tipoSensor, visual.color, 16)}</span>
          </div>
        `;

        const sensorIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-sensor-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker(s.ubicacion, { icon: sensorIcon });
        marker.on('click', () => onSelectElement({ tipo: 'SENSOR', data: s }));
        marker.bindTooltip(
          `<b>${s.nombre}</b><br/>${visual.label}: ${valor} ${s.unidad}<br/>Estado: ${estado} · <i>dato simulado</i>`,
          { sticky: true }
        );
        gSensores.addLayer(marker);
      });
    }

    // E) CAPA RUTAS DE DESVÍO Y MITIGACIÓN (Simulación activa)
    if (capasActivas.rutas && rutasDesvio.length > 0) {
      rutasDesvio.forEach((ruta, idx) => {
        const polyline = L.polyline(ruta.coordenadasRuta, {
          color: '#38BDF8',
          weight: 5,
          opacity: 0.85,
          dashArray: '8, 8',
          lineCap: 'round'
        });

        polyline.on('click', () => onSelectElement({ tipo: 'RUTA', data: ruta }));
        polyline.bindTooltip(
          `<b>Ruta de Mitigación #${idx + 1}</b><br/>${ruta.origen} &rarr; ${ruta.destino}<br/>Capacidad: +${ruta.capacidadDesvioHora} pers/h`,
          { sticky: true }
        );
        gRutas.addLayer(polyline);
      });
    }

    // F) NARRATIVA CARTOGRÁFICA DEL ESCENARIO (datos sintéticos de demo)
    if (simulacionVisual.escenarioId !== 'base' && simulacionVisual.intensidad >= 0.04) {
      const intensidad = Math.max(0.15, Math.min(1, simulacionVisual.intensidad));
      const configuracion = simulacionVisual.escenarioId === 'crucero_masivo'
        ? {
            color: '#06b6d4',
            puntos: RUTAS_CRUCERO_VIARIAS,
            etiqueta: 'Flujo simulado de cruceristas'
          }
        : simulacionVisual.escenarioId === 'evento_cultural'
          ? {
              color: '#d946ef',
              puntos: RUTAS_EVENTO_VIARIAS,
              etiqueta: 'Circuito cultural nocturno'
            }
          : null;

      if (simulacionVisual.escenarioId === 'episodio_meteo' && zonasInundacion) {
        const estilos = {
          alto: { fill: '#0369a1', opacidad: 0.8, etiqueta: 'alto' },
          medio: { fill: '#0ea5e9', opacidad: 0.55, etiqueta: 'medio' },
          bajo: { fill: '#7dd3fc', opacidad: 0.4, etiqueta: 'bajo' }
        } as const;
        zonasInundacion.features.forEach((feature: any) => {
          const estilo = estilos[feature.properties.riesgo as keyof typeof estilos];
          const capa = L.geoJSON(feature as any, {
            interactive: true,
            style: { stroke: false, fillColor: estilo.fill, fillOpacity: estilo.opacidad * (0.35 + 0.65 * intensidad) }
          });
          capa.bindTooltip(`<b>Posible acumulación de agua</b><br/>Riesgo ${estilo.etiqueta} · calzada sin edificios<br/><b>${Math.round(intensidad * 100)}% de intensidad</b>`, { sticky: true });
          gSimulacion.addLayer(capa);
        });
      }

      simulacionVisual.flujos?.forEach(flujoModelo => {
        const peso = flujoModelo.peso;
        const linea = L.polyline(flujoModelo.puntos, {
          color: flujoModelo.color,
          weight: (3 + intensidad * 4) * peso + 1,
          opacity: (0.4 + intensidad * 0.5) * (flujoModelo.esDesvio ? 0.9 : 1),
          dashArray: flujoModelo.esDesvio ? '2, 12' : '3, 12',
          lineCap: 'round',
          className: 'simulation-flow-path simulation-flow-modelo'
        });
        linea.bindTooltip(`${flujoModelo.etiqueta}<br/><b>${Math.round(intensidad * peso * 100)}% de intensidad</b>`, { sticky: true });
        gSimulacion.addLayer(linea);
        const fin = flujoModelo.puntos[flujoModelo.puntos.length - 1];
        const pulsoModelo = L.divIcon({
          className: 'simulation-pulse-icon',
          html: `<span class="simulation-pulse" style="--simulation-color:${flujoModelo.color}; --simulation-opacity:${(0.3 + intensidad * 0.45) * peso + 0.1}; transform:scale(${flujoModelo.esDesvio ? 0.65 : 1})"></span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        gSimulacion.addLayer(L.marker(fin, { icon: pulsoModelo, interactive: false }));
      });

      configuracion?.puntos.forEach((coordenadas, indice) => {
        const flujo = L.polyline(coordenadas, {
          color: configuracion.color,
          weight: 4 + intensidad * 4,
          opacity: 0.38 + intensidad * 0.55,
          dashArray: '3, 12',
          lineCap: 'round',
          className: `simulation-flow-path simulation-flow-${simulacionVisual.escenarioId}`
        });
        flujo.bindTooltip(`${configuracion.etiqueta} ${indice + 1}<br/><b>${Math.round(intensidad * 100)}% de intensidad</b>`, { sticky: true });
        gSimulacion.addLayer(flujo);

        const destinoFlujo = coordenadas[coordenadas.length - 1];
        const pulso = L.divIcon({
          className: 'simulation-pulse-icon',
          html: `<span class="simulation-pulse" style="--simulation-color:${configuracion.color}; --simulation-opacity:${0.35 + intensidad * 0.5}"></span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        gSimulacion.addLayer(L.marker(destinoFlujo, { icon: pulso, interactive: false }));
      });
    }

  }, [zonas, recursos, sensores, capasActivas, tipoMapaCalor, rutasDesvio, nivelVisualizacion, cartografiaBase, simulacionVisual, zonasInundacion]);

  // 4b. Edificios de Catastro: la capa se construye una sola vez por cartografía; los KPI solo la recolorean.
  const capasEdificiosRef = useRef<{ layer: any; punto: PuntoEdificio; baseFill: string }[]>([]);
  const puntosEdificiosRef = useRef<PuntoEdificio[]>([]);
  const kpiMapaRef = useRef(kpiMapa);
  kpiMapaRef.current = kpiMapa;
  const sensoresRef = useRef(sensores);
  sensoresRef.current = sensores;
  const onSelectElementRef = useRef(onSelectElement);
  onSelectElementRef.current = onSelectElement;

  useEffect(() => {
    const gEdificios = layersGroupRef.current.edificios25D;
    if (!mapInstanceRef.current || !gEdificios) return;
    gEdificios.clearLayers();
    capasEdificiosRef.current = [];
    puntosEdificiosRef.current = [];
    if (!cartografiaBase || !edificiosCatastro) return;

    const rendererEdificios = L.canvas({ pane: 'edificiosCatastroPane', padding: 0.5 });
    const entradas: { layer: any; punto: PuntoEdificio; baseFill: string }[] = [];
    const colorBase = (plantas: number) => plantas >= 6 ? '#0c4a6e' : plantas >= 3 ? '#0284c7' : '#38bdf8';
    const capaCatastro = L.geoJSON(edificiosCatastro, {
      style: feature => {
        const plantas = Number(feature?.properties?.numberOfFloorsAboveGround || 1);
        return {
          pane: 'edificiosCatastroPane',
          renderer: rendererEdificios,
          color: '#0369a1',
          weight: plantas >= 5 ? 1.15 : 0.75,
          fillColor: colorBase(plantas),
          fillOpacity: 0.62
        };
      },
      onEachFeature: (feature, layer) => {
        const plantas = Number(feature?.properties?.numberOfFloorsAboveGround || 1);
        const alturaEstimada = Math.max(3, plantas * 3);
        const c = centroideGeoJSON(feature?.geometry);
        entradas.push({ layer, punto: { lat: c ? c[0] : NaN, lng: c ? c[1] : NaN, plantas }, baseFill: colorBase(plantas) });
        // Los valores por KPI solo se evalúan al pasar el ratón o hacer clic.
        const kpisEdificio = () => c ? valoresKpiEdificio(modelosKpiCacheados(sensoresRef.current), c[0], c[1], plantas) : [];
        layer.bindTooltip(() => {
          const activo = kpiMapaRef.current;
          const filasKpi = kpisEdificio().map(v => `<span style="display:flex;justify-content:space-between;gap:12px;${v.kpi === activo ? 'font-weight:700;' : ''}">`
            + `<span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${v.color};border:1px solid ${oscurecer(v.color, 0.7)};margin-right:5px"></i>${v.label}</span><span>${v.texto}</span></span>`).join('');
          return `<strong>Edificio</strong><br/>Plantas: ${plantas}<br/>Altura analítica: ~${alturaEstimada} m`
            + (filasKpi ? `<hr style="margin:4px 0;border:0;border-top:1px solid #cbd5e1"/><span style="font-size:10px;color:#64748b">Datos simulados (kriging)</span>${filasKpi}` : '');
        }, { sticky: true, className: 'leaflet-light-tooltip' });
        layer.on('click', () => onSelectElementRef.current({
          tipo: 'EDIFICIO_CATASTRO',
          data: {
            ...feature.properties,
            plantas,
            alturaEstimada,
            kpisSimulados: kpisEdificio(),
            fuente: 'D.G. del Catastro · INSPIRE BU'
          }
        }));
      }
    });
    capasEdificiosRef.current = entradas;
    const puntos = entradas.map(e => e.punto);
    puntosEdificiosRef.current = puntos;
    gEdificios.addLayer(capaCatastro);
    aplicarKpiEdificios();
    precalentarKpis(puntos, sensoresRef.current, () => puntosEdificiosRef.current !== puntos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartografiaBase, edificiosCatastro]);

  const ultimoAplicadoRef = useRef<{ entradas: unknown; colores: string[] | null } | null>(null);
  function aplicarKpiEdificios() {
    const entradas = capasEdificiosRef.current;
    if (!entradas.length) return;
    const kpi = kpiMapaRef.current;
    const colores = kpi ? coloresKpiEdificios(puntosEdificiosRef.current, sensoresRef.current, kpi) : [];
    const aplicado = kpi && colores.length ? colores : null;
    const previo = ultimoAplicadoRef.current;
    if (previo && previo.entradas === entradas && previo.colores === aplicado) return; // nada cambió
    ultimoAplicadoRef.current = { entradas, colores: aplicado };
    entradas.forEach((entrada, i) => {
      const color = colores[i];
      if (color) entrada.layer.setStyle({ fillColor: color, color: oscurecer(color, 0.82) });
      else entrada.layer.setStyle({ fillColor: entrada.baseFill, color: '#0369a1' });
    });
  }

  useEffect(() => {
    aplicarKpiEdificios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiMapa, sensores]);

  return (
    <div className="relative w-full h-full">
      {/* Contenedor del mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {simulacionVisual.escenarioId !== 'base' && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-xl border border-white/80 bg-slate-950/88 px-4 py-2 text-center text-white shadow-xl backdrop-blur">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">Simulación activa · datos sintéticos</div>
          <div className="mt-0.5 text-xs font-semibold">{simulacionVisual.escenarioNombre}</div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-300">{String(simulacionVisual.hora).padStart(2, '0')}:00 · Intensidad {Math.round(simulacionVisual.intensidad * 100)}%</div>
        </div>
      )}

      {simulacionVisual.escenarioId === 'episodio_meteo' && simulacionVisual.intensidad >= 0.12 && (
        <div className="simulation-rain-overlay pointer-events-none absolute inset-0 z-[5]" style={{ opacity: Math.min(0.48, 0.12 + simulacionVisual.intensidad * 0.28) }} />
      )}

      {cartografiaBase && (
        <div className="absolute left-4 top-4 z-10 max-w-[280px] rounded-lg border border-sky-200 bg-white/95 p-3 text-[11px] text-slate-700 shadow-xl backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-bold uppercase tracking-wide text-sky-800">Base real + simulación</span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
              estadoCartografia === 'lista' ? 'bg-emerald-100 text-emerald-700' :
              estadoCartografia === 'error' ? 'bg-rose-100 text-rose-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {estadoCartografia === 'lista' ? 'Cargada' : estadoCartografia === 'error' ? 'Error' : 'Cargando'}
            </span>
          </div>
          <div><b>Catastro:</b> {cartografiaBase.edificiosEsperados.toLocaleString('es-ES')} piezas de edificios</div>
          {nivelVisualizacion >= 2 && <div><b>Terreno:</b> {cartografiaBase.etiquetaRelieve}</div>}
          <div><b>Simulación:</b> afluencia, POI, sensores y rutas de mitigación</div>
          <div className="mt-1 text-[10px] text-slate-500">
            {nivelVisualizacion >= 2
              ? 'Edificios reales sobre MDT50; las capas operativas se identifican como simuladas.'
              : 'Huellas reales de Catastro combinadas con capas operativas simuladas para la demo.'}
          </div>
        </div>
      )}

      {/* Leyenda rápida inferior derecha */}
      <div className="absolute bottom-6 right-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-300 shadow-2xl flex flex-col space-y-1.5">
        {cartografiaBase ? (
          <>
            {kpiMapa ? (
              <>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Edificios · {KPI_MAPA_CONFIG[kpiMapa].label}</div>
                {clasesLeyenda(kpiMapa).map(c => (
                  <div key={c.desde} className="flex items-center space-x-2">
                    <span className="w-4 h-3 rounded-sm border" style={{ background: c.color, borderColor: oscurecer(c.color, 0.75) }}></span>
                    <span className="font-mono text-[10px]">{textoClase(kpiMapa, c)}</span>
                  </div>
                ))}
                <div className="text-[10px] italic text-slate-500 max-w-[190px]">Kriging ordinario sobre sensores simulados y estaciones virtuales sintéticas</div>
              </>
            ) : (
              <>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Edificios reales · Catastro</div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-sm bg-sky-400"></span>
                  <span>1–2 plantas</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-sm bg-sky-600"></span>
                  <span>3–5 plantas</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-sm bg-sky-900"></span>
                  <span>6 o más plantas</span>
                </div>
              </>
            )}
            {capasActivas.calor && (
              <div className="flex items-center space-x-2 border-t border-slate-700 pt-1.5">
                <span className="h-2 w-5 rounded-sm" style={{ background: HEATMAP_GRADIENT_CSS[tipoMapaCalor] }}></span>
                <span>Calor de {HEATMAP_LABELS[tipoMapaCalor].toLowerCase()} <i>(simulado)</i></span>
              </div>
            )}
            {capasActivas.recursos && (
              <div className="flex items-center space-x-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-red-400 bg-white text-[8px] text-slate-900">●</span>
                <span>POI turístico <i>(simulado)</i></span>
              </div>
            )}
            {capasActivas.sensores && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-700 pt-1.5">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-cyan-400" />Aforo</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-purple-500" />Ruido</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-orange-500" />Temperatura</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Aire</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Capacidad de Carga</div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
              <span>Normal (&lt; 65%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
              <span>Precaución (65% - 89%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-red-500"></span>
              <span>Saturación / Riesgo (&ge; 90%)</span>
            </div>
          </>
        )}
        {(() => {
          const flujo = leyendaFlujoSimulacion(simulacionVisual.escenarioId, simulacionVisual.intensidad);
          return flujo && (
            <div className="flex items-center space-x-2 pt-1 border-t border-slate-800">
              <span className="w-4 h-1 border-b-[3px] border-dashed" style={{ borderColor: flujo.color }}></span>
              <span className="font-medium" style={{ color: flujo.color }}>{flujo.etiqueta}</span>
            </div>
          );
        })()}
        {leyendaFlujosModelo(simulacionVisual.flujos ?? []).map(item => (
          <div key={item.etiqueta} className="flex items-center space-x-2 pt-1 border-t border-slate-800">
            <span className="w-4 h-1 border-b-[3px] border-dashed" style={{ borderColor: item.color }}></span>
            <span className="font-medium" style={{ color: item.color }}>{item.etiqueta}</span>
          </div>
        ))}
        {rutasDesvio.length > 0 && capasActivas.rutas && (
          <div className="flex items-center space-x-2 pt-1 border-t border-slate-800">
            <span className="w-4 h-1 border-b-2 border-dashed border-sky-400"></span>
            <span className="text-sky-300 font-medium">Ruta Desvío Activa</span>
          </div>
        )}
      </div>
    </div>
  );
};
