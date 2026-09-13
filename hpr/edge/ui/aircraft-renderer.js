/* Atlas Edge aircraft renderer.
 * Type-aware silhouettes + altitude colour bands, driven by local readsb DB metadata.
 * No generic triangle renderer.
 */
(()=>{'use strict';
const SHAPES={
 airliner:{vb:'0 0 64 64',body:'<path d="M30 3h4l3 20 21 10v4l-21-4-2 17 8 6v3l-11-3-11 3v-3l8-6-2-17-21 4v-4l21-10z"/>'},
 heavy4:{vb:'0 0 64 64',body:'<path d="M29 2h6l3 20 22 9v5l-22-3-2 17 10 6v4l-14-4-14 4v-4l10-6-2-17-22 3v-5l22-9z"/><circle cx="17" cy="31" r="2.4"/><circle cx="24" cy="29" r="2.4"/><circle cx="40" cy="29" r="2.4"/><circle cx="47" cy="31" r="2.4"/>'},
 jet:{vb:'0 0 64 64',body:'<path d="M30 5h4l3 19 18 8v4l-18-3-2 15 8 6v3l-11-3-11 3v-3l8-6-2-15-18 3v-4l18-8z"/>'},
 fighter:{vb:'0 0 64 64',body:'<path d="M31 3h2l5 20 20 10-2 5-17-5 7 17-5 2-9-9-9 9-5-2 7-17-17 5-2-5 20-10z"/>'},
 twinprop:{vb:'0 0 64 64',body:'<path d="M30 5h4l2 18 22 8v5l-21-3-2 16 9 6v3l-12-3-12 3v-3l9-6-2-16-21 3v-5l22-8z"/><circle cx="19" cy="30" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="45" cy="30" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/>'},
 transport:{vb:'0 0 64 64',body:'<path d="M29 4h6l2 18 23 9v5l-22-3-2 17 10 5v4l-14-3-14 3v-4l10-5-2-17-22 3v-5l23-9z"/><rect x="14" y="27" width="7" height="5" rx="2"/><rect x="43" y="27" width="7" height="5" rx="2"/>'},
 ga:{vb:'0 0 64 64',body:'<path d="M30 7h4l2 17 20 8v4l-20-3-2 16 8 5v3l-10-3-10 3v-3l8-5-2-16-20 3v-4l20-8z"/><path d="M25 11h14v2H25z"/>'},
 helicopter:{vb:'0 0 64 64',body:'<path d="M21 30c2-8 8-12 17-10 8 2 11 8 9 14-2 5-7 8-15 8H20c-5 0-8-3-8-6 0-4 3-6 9-6z"/><path d="M31 20V13h3v7M6 11h53v3H6zM47 31h11v3H47zM56 25h3v15h-3zM24 43l-5 8h4l5-8zM39 43l5 8h4l-5-8z"/>'},
 tiltrotor:{vb:'0 0 64 64',body:'<path d="M29 5h6l2 20 18 6v5l-18-2-2 16 9 6v3l-12-3-12 3v-3l9-6-2-16-18 2v-5l18-6z"/><circle cx="13" cy="30" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="51" cy="30" r="7" fill="none" stroke="currentColor" stroke-width="2"/>'},
 uav:{vb:'0 0 64 64',body:'<path d="M5 37 32 19l27 18-22-6-5 14-5-14z"/><path d="M30 8h4v15h-4z"/>'},
 glider:{vb:'0 0 64 64',body:'<path d="M30 7h4l2 20 26 5v3l-26-2-2 17 8 5v3l-10-3-10 3v-3l8-5-2-17-26 2v-3l26-5z"/>'},
 balloon:{vb:'0 0 64 64',body:'<path d="M32 5c-10 0-18 8-18 19 0 12 9 21 14 25h8c5-4 14-13 14-25C50 13 42 5 32 5z"/><path d="M28 49h8l3 8H25z"/>'},
 ground:{vb:'0 0 64 64',body:'<rect x="10" y="22" width="44" height="24" rx="7"/><path d="M18 22l5-8h18l5 8z"/><circle cx="20" cy="48" r="5"/><circle cx="44" cy="48" r="5"/>'},
 unknown:{vb:'0 0 64 64',body:'<path d="M30 5h4l3 20 20 9v4l-20-4-2 16 8 6v3l-11-3-11 3v-3l8-6-2-16-20 4v-4l20-9z"/>'}
};
const COLORS={g:'#7b8794',c0:'#2ecc71',c1:'#3498db',c2:'#f1c40f',c3:'#e67e22',c4:'#e74c3c'};
const HEAVY4=/^(A124|A225|AN22|A388|A34[0-9]|B74[0-9A-Z]|IL96)$/;
const TWINPROP=/^(AT7[2356]|DH8[A-D]|SF34|PA34|BE58|BE9L|BE20)$/;
const TRANSPORT=/^(C130|P3|AN12|IL76|C17|C5M?|E3CF|E3TF|E6)$/;
const GA=/^(C1(52|72|82)|C206|C210|PA2[8]|PA32|BE36|SR2[02]|PC12|TBM[789])$/;
const FIGHTER=/^(A10|F1[4568]|F22A?|F35|F4|F5|MG(19|25|29|31)|SU(15|24|25|27)|RFAL|EF2K|TYPH|T38|TOR|MIR4)$/;
const UAV=/^(RQ4|MQ[19]|TB2|ANKA)$/;
const HELI=/^(AH64|AH1|UH60|S70|CH47|CH53|AS(32|33|50|55|65)|EC(20|25|30|35|45|55|65|75)|R(22|44|66)|B0[67]|B12|B47G|MI(8|17|24|28)|PUMA|TIGR|H(53|60|64|160)|S(61|76|92)|A(109|129|139|169|189)|B222|B407|B429|MH6)$/;
const TILT=/^(V22|V22F|B609|B609F)$/;
const GLIDER=/^(GLID|ASK2|DG80)$/;
const BALLOON=/^(BALL)$/;
const code=a=>String(a?.typeCode||'').trim().toUpperCase();
function band(a){if(a?.isGround)return'g';const n=Number(a?.barometricAltitudeFt);if(!Number.isFinite(n))return'c2';if(n<5000)return'c0';if(n<15000)return'c1';if(n<30000)return'c2';if(n<42000)return'c3';return'c4'}
function family(a){const c=code(a),cat=String(a?.categoryCode||'').toUpperCase();if(a?.isGround||cat.startsWith('C'))return'ground';if(TILT.test(c))return'tiltrotor';if(HELI.test(c)||cat==='A7')return'helicopter';if(UAV.test(c)||cat==='B6')return'uav';if(GLIDER.test(c)||cat==='B1')return'glider';if(BALLOON.test(c)||cat==='B2')return'balloon';if(FIGHTER.test(c)||cat==='A6')return'fighter';if(HEAVY4.test(c)||cat==='A5')return'heavy4';if(TRANSPORT.test(c))return'transport';if(TWINPROP.test(c))return'twinprop';if(GA.test(c)||cat==='A1')return'ga';if(/^(GLF|CL[356]|C[67]50|CRJ|E1[3479]|E45|BCS|SF50)/.test(c))return'jet';if(c||cat==='A3'||cat==='A4')return'airliner';return'unknown'}
function isRotorcraft(a){const f=family(a);return f==='helicopter'||f==='tiltrotor'}
function rotorcraftReason(a){return isRotorcraft(a)?(code(a)?'type':'category'):''}
function exactRotorcraft(a){return isRotorcraft(a)?{code:code(a),label:code(a)||'Rotorcraft'}:null}
function svg(f,color){const s=SHAPES[f]||SHAPES.unknown;return `<svg viewBox="${s.vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="color:${color}"><g fill="${color}" stroke="#0b1220" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round">${s.body}</g></svg>`}
function iconKey(a){return`${family(a)}-${band(a)}`}
function markup(a){return svg(family(a),COLORS[band(a)]||COLORS.c2)}
function mapImages(){const out=[];for(const f of Object.keys(SHAPES))for(const [b,color]of Object.entries(COLORS))out.push({name:`aircraft-${f}-${b}`,svg:svg(f,color)});return out}
window.HPRAircraftRenderer=Object.freeze({baseKey:family,family,band,iconKey,markup,mapImages,isRotorcraft,rotorcraftReason,exactRotorcraft});
})();
