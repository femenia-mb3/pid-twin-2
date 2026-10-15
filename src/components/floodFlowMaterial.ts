import { Cartesian3, Cartesian4, Color, Event, Material, Matrix4, Transforms } from 'cesium';

// Material de agua que corre sobre las zonas inundadas del visor 3D: franjas onduladas que avanzan
// en el sentido de la corriente. Se calcula en el shader a partir de la posición en el mundo, así que
// no necesita texturas ni geometría extra; la fase la marca el temporizador que ya anima los flujos.
const TIPO = 'FloodFlow';
const ORIGEN = Cartesian3.fromDegrees(-4.42, 36.715, 0);
const ENU = Transforms.eastNorthUpToFixedFrame(ORIGEN);
const ESTE = Cartesian3.fromCartesian4(Matrix4.getColumn(ENU, 0, new Cartesian4()));
const NORTE = Cartesian3.fromCartesian4(Matrix4.getColumn(ENU, 1, new Cartesian4()));

const cache = (Material as any)._materialCache;
if (!cache.getMaterial(TIPO)) {
  cache.addMaterial(TIPO, {
    fabric: {
      type: TIPO,
      uniforms: {
        baseColor: new Color(0.01, 0.52, 0.78, 0.6),
        flowDir: new Cartesian3(1, 0, 0),
        crossDir: new Cartesian3(0, 1, 0),
        origin: ORIGEN,
        phase: 0,
      },
      source: `
        czm_material czm_getMaterial(czm_materialInput materialInput) {
          czm_material material = czm_getDefaultMaterial(materialInput);
          vec3 p = (czm_inverseView * vec4(-materialInput.positionToEyeEC, 1.0)).xyz - origin;
          float along = dot(p, flowDir);
          float across = dot(p, crossDir);
          float w = sin(along / 7.0 - phase * 6.2831853 + sin(across / 5.0) * 1.6);
          float streak = smoothstep(0.55, 0.95, w);
          material.diffuse = mix(baseColor.rgb, vec3(0.88, 0.95, 1.0), streak * 0.75);
          material.alpha = min(1.0, baseColor.a + streak * 0.2);
          return material;
        }`,
    },
    translucent: () => true,
  });
}

// Pasos de 45°, 0 = este, creciendo hacia el sur (mismo convenio que malaga-flujos-agua.json).
const orientaciones = Array.from({ length: 8 }, (_, k) => {
  const a = (k * 45 * Math.PI) / 180;
  const flujo = Cartesian3.add(
    Cartesian3.multiplyByScalar(ESTE, Math.cos(a), new Cartesian3()),
    Cartesian3.multiplyByScalar(NORTE, -Math.sin(a), new Cartesian3()),
    new Cartesian3(),
  );
  const cruce = Cartesian3.add(
    Cartesian3.multiplyByScalar(ESTE, Math.sin(a), new Cartesian3()),
    Cartesian3.multiplyByScalar(NORTE, Math.cos(a), new Cartesian3()),
    new Cartesian3(),
  );
  return { flujo, cruce };
});

export class FloodFlowMaterialProperty {
  readonly isConstant = false;
  readonly definitionChanged = new Event();
  constructor(private color: () => Color, private sentido: number, private fase: () => number) {}
  getType() { return TIPO; }
  getValue(_time: unknown, result: Record<string, unknown> = {}) {
    const o = orientaciones[this.sentido] ?? orientaciones[0];
    result.baseColor = this.color();
    result.flowDir = o.flujo;
    result.crossDir = o.cruce;
    result.origin = ORIGEN;
    result.phase = this.fase();
    return result;
  }
  equals(other: unknown) {
    return this === other || (other instanceof FloodFlowMaterialProperty && other.sentido === this.sentido && other.color === this.color);
  }
}
