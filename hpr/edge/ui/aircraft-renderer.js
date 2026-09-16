/* Atlas Edge renderer backed by the HPR Globe aircraft shape library (acicon.js). */
(()=>{'use strict';
const Shapes=window.Shapes||{},TypeDesignatorIcons=window.TypeDesignatorIcons||{},TypeDescriptionIcons=window.TypeDescriptionIcons||{},CategoryIcons=window.CategoryIcons||{};
const ROTOR_TYPES=new Set(['AS50','AS55','GAZL','B407','R22','R44','R66','MH6','B222','EC35','EC45','EC30','B429','A109','AS65','S76','A139','A169','H160','EC75','A189','S61','EC25','EH10','H53','S92','NH90','H60','PUMA','AS32','MI24','TIGR','H64','A129','AH1J','AH1Z','H47','H46','V22','V22F','B609','B609F']);
const ALT_COLORS=['#3b82f6','#22c55e','#eab308','#f97316','#ef4444','#a855f7'];
const code=a=>String(a?.typeCode||'').trim().toUpperCase();
const category=a=>String(a?.categoryCode||'').trim().toUpperCase();
function shapeName(a){
  const c=code(a);if(c&&TypeDesignatorIcons[c])return TypeDesignatorIcons[c];
  const desc=String(a?.typeDescription||'').trim().toUpperCase();
  if(desc){if(TypeDescriptionIcons[desc])return TypeDescriptionIcons[desc];const b=desc.charAt(0);if(TypeDescriptionIcons[b])return TypeDescriptionIcons[b]}
  const cat=category(a);if(cat&&CategoryIcons[cat])return CategoryIcons[cat];
  return'unknown';
}
function shape(name){return Shapes[name]||Shapes.unknown||Shapes.airliner||{viewBox:'0 0 32 32',path:''}}
function shapeSvg(s,color){s=s||{};const vb=(s.viewBox||'0 0 32 32').split(/[\s,]+/).map(Number),cx=(vb[0]||0)+(vb[2]||32)/2,cy=(vb[1]||0)+(vb[3]||32)/2,side=Math.max(vb[2]||32,vb[3]||32)*1.1/(s.scale||1),fill=color||'currentColor';return `<svg viewBox="${cx-side/2} ${cy-side/2} ${side} ${side}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${s.path||''}" fill="${fill}" stroke="#111827" stroke-width=".4" stroke-linejoin="round"/></svg>`}
function altBand(ft){const a=Number(ft);if(!Number.isFinite(a))return 0;if(a<3000)return 0;if(a<8000)return 1;if(a<15000)return 2;if(a<25000)return 3;if(a<35000)return 4;return 5}
function rotorcraftReason(a){const c=code(a);if(c&&ROTOR_TYPES.has(c))return'type';const description=String(a?.typeDescription||a?.airframeClass||a?.type||'').toUpperCase();if(description.includes('ROTORCRAFT')||description.includes('HELICOPTER')||description.includes('TILTROTOR'))return'description';if(category(a)==='A7')return'category';return''}
function isRotorcraft(a){return a?.kind==='aircraft'&&!!rotorcraftReason(a)}
function iconKey(a){return shapeName(a)}
function markup(a){return shapeSvg(shape(shapeName(a)),'currentColor')}
window.HPRAircraftRenderer=Object.freeze({iconKey,shapeName,shape,shapeSvg,markup,isRotorcraft,rotorcraftReason,altBand,ALT_COLORS});
})();
