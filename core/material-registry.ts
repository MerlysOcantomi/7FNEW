export const MATERIAL_STORAGE_KEY = "7f-material"
export const APP_MATERIALS = ["solid", "glass"] as const
export type AppMaterial = typeof APP_MATERIALS[number]
export const DEFAULT_APP_MATERIAL: AppMaterial = "glass"

export function isAppMaterial(value: unknown): value is AppMaterial {
  return typeof value === "string" && (APP_MATERIALS as readonly string[]).includes(value)
}

/** Pre-paint material bootstrap. Only accepts the finite application material set. */
export function buildMaterialBootstrap(defaultMaterial: AppMaterial = DEFAULT_APP_MATERIAL): string {
  return `(function(){var A=${JSON.stringify(APP_MATERIALS)},K=${JSON.stringify(MATERIAL_STORAGE_KEY)},D=${JSON.stringify(defaultMaterial)};function valid(x){return typeof x==='string'&&A.indexOf(x)!==-1;}var q=null,s=null;try{q=new URLSearchParams(location.search).get('material');}catch(e){}try{s=localStorage.getItem(K);}catch(e){}if(valid(q)){try{localStorage.setItem(K,q);}catch(e){}}document.documentElement.setAttribute('data-material',valid(q)?q:valid(s)?s:D);})();`
}
