// Authored 2D parts, traced by observation of the clothed Ame/Terami game models.
export const defs = `<defs>
<linearGradient id="p-skin" x2=".7" y2="1"><stop stop-color="#fff1e5"/><stop offset="1" stop-color="#e3aca3"/></linearGradient>
<linearGradient id="p-ame" x2=".9" y2="1"><stop stop-color="#dbe6f4"/><stop offset=".45" stop-color="#96a9c8"/><stop offset="1" stop-color="#52637f"/></linearGradient>
<linearGradient id="p-tera" x2=".7" y2="1"><stop stop-color="#d3efff"/><stop offset=".45" stop-color="#79b9e8"/><stop offset="1" stop-color="#3e709e"/></linearGradient>
<linearGradient id="p-coat" x2="1" y2="1"><stop stop-color="#424655"/><stop offset="1" stop-color="#171c2b"/></linearGradient>
<linearGradient id="p-brown" x2="1" y2="1"><stop stop-color="#dab58b"/><stop offset=".5" stop-color="#b28a67"/><stop offset="1" stop-color="#75543f"/></linearGradient>
<linearGradient id="p-white" x2="1" y2="1"><stop stop-color="#faf6ee"/><stop offset="1" stop-color="#a5b5ce"/></linearGradient>
<linearGradient id="p-iris" x2="0" y2="1"><stop stop-color="#254765"/><stop offset=".6" stop-color="#6bb9dc"/><stop offset="1" stop-color="#c3f4f5"/></linearGradient>
</defs>`;
const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const star=(x,y)=>`<g transform="translate(${x} ${y})"><path d="M0-14 4-5 14-4 7 3 9 14 0 9-10 14-8 2-15-5-4-6Z" fill="#aecce1" stroke="#e9ce85" stroke-width="2"/><circle r="4" fill="#f6f5d5"/></g>`;
function eye(x){return `<g transform="translate(${x} 127)"><g data-eye>${path('M-15 0Q0-13 16 0Q10 15 0 16Q-12 14-15 0','#fff9f2')}<g data-pupil><ellipse cy="5" rx="9" ry="12" fill="url(#p-iris)"/><ellipse cy="3" rx="3.4" ry="8" fill="#20374e"/><circle cx="-3" cy="-2" r="3.6" fill="white"/><circle cx="4" cy="10" r="1.8" fill="white"/></g><path d="M-17 0Q-3-15 17-1L13-6" fill="none" stroke="#333b54" stroke-width="3"/><path d="M-11 13Q0 19 12 11" fill="none" stroke="#ad777c" stroke-width="1"/></g><path data-lid d="M-16 0Q0 10 16 0" fill="none" stroke="#333b54" stroke-width="3" opacity="0"/></g>`}
export function character(id){const a=id==='ame',hair=a?'url(#p-ame)':'url(#p-tera)';
const fur=Array.from({length:17},(_,i)=>{const x=-108+i*13,y=211+Math.abs(x)*.17;return path(`M${x-12} ${y+9}l-4-17 11 6 4-15 8 14 11-6-2 20Z`,'url(#p-white)')}).join('');
const strands=Array.from({length:10},(_,i)=>{const x=-69+i*15;return `<path d="M${x*.4} 48Q${x+22} 72 ${x} ${a?146:113}" fill="none" stroke="${i%2?'#e0f1fc':'#526f98'}" stroke-opacity=".42" stroke-width="1.3"/>`}).join('');
return `<g data-character="${id}" stroke="#35435c" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
<g data-body>
${a?path('M-78 211Q-133 223-146 380H146Q132 230 78 211L0 235Z','url(#p-coat)')+path('M-101 242-135 377H-100L-65 249M101 242 135 377H100L65 249','#5f6f86')+fur:path('M-70 209Q-116 223-125 360L-77 380H77L125 360Q116 223 70 209Z','url(#p-brown)')}
${path('M-65 222-76 380H76L65 222 30 205H-30Z',a?'url(#p-coat)':'#34323c')}
${path('M-27 186-28 218 0 243 28 218 27 186','url(#p-skin)')}
${a?path('M-29 211-47 224-29 275 0 237 29 275 48 224 29 211 0 232Z','url(#p-white)')+path('M-6 232-14 248-5 305 7 318 17 250 8 232Z','#6266a4')+path('M-50 229-65 265 0 325 62 265 50 229 29 275 0 324-29 275Z','#272b37','stroke="#c4cedb"')+star(-47,261)+`<path d="M-47 276q-12 25 11 32t9-28" fill="none" stroke="#a3b4c7" stroke-dasharray="2 3"/>`:
path('M-30 206-43 221 0 245 43 221 30 206 0 227Z','url(#p-brown)')+path('M-7 229 0 239 8 229 19 271 0 258-20 272Z','#e8cf9c')+[-22,22].map(x=>[270,301,332,363].map(y=>`<circle cx="${x}" cy="${y}" r="4.3" fill="#e5c582" stroke="#8c744e"/>`).join('')).join('')}
${a?`<path d="M-60 356 35 374 65 358M-60 362 35 380 65 364" fill="none" stroke="#aab9c8"/><rect x="38" y="337" width="12" height="17" fill="none" stroke="#b4bdc9"/>`:path('M-74 360H74V379H-74Z','#332b29')+`<rect x="-12" y="360" width="24" height="18" rx="2" fill="none" stroke="#dab67b"/>`}
</g>
<g data-head>
<g data-hair-back>${path('M-77 85Q-101 144-72 199L-55 183-60 208-37 187H40L62 204 57 182 81 190Q102 143 76 83Z',hair)}</g>
${a?`<g data-ears>${path('M-73 83-88 10Q-48 24-35 57M35 57Q48 24 88 10L73 83',hair)}${path('M-70 65-77 26-48 55M48 55 77 26 70 65','#e5e7f2')}${path('M-71 55-77 43-62 50-65 37-51 54M51 54 65 37 62 50 77 43 71 55','#fff5ef')}</g>`:''}
${path('M-66 119Q-90 108-79 142L-63 151M66 119Q90 108 79 142L63 151','url(#p-skin)')}
${path('M-67 91Q-75 159-42 184L0 205Q42 197 64 162L70 95Q13 44-67 91Z','url(#p-skin)')}
${path('M-65 113Q-52 84-23 86L22 86Q49 88 68 116L65 92Q0 54-65 92Z','#ba8c8d','opacity=".25"')}
<path d="M-45 109q13-7 27-2M20 107q14-7 28 2" fill="none" stroke="#5c6781" stroke-width="2"/>
${eye(-31)}${eye(31)}
<g fill="#e898a4" opacity=".3" stroke="none"><ellipse cx="-43" cy="154" rx="16" ry="7"/><ellipse cx="43" cy="154" rx="16" ry="7"/></g>
<path d="M6 144 3 152 8 154" fill="none" stroke="#bf8b8a" stroke-width="1"/>
<path data-mouth d="M-10 172Q3 181 17 169" fill="none" stroke="#a65f70" stroke-width="2"/>
<g data-fringe>${path(a?'M-79 122Q-102 62-51 43Q-14 23 16 45Q58 30 80 68L91 103 77 96 85 129 71 117 64 159 52 146 49 111 35 89Q16 144-42 158L-25 139-61 158-53 137-72 162Z':'M-80 118Q-100 70-57 50Q-22 28 16 46Q55 35 79 67L96 92 79 90 91 119 70 110 76 144 58 132 55 108 33 85 30 125 12 106 3 81-8 120-25 104-32 85-45 124-54 106-63 151-76 137Z',hair)}${strands}
<path d="M-57 64Q-23 39 10 53M22 54Q54 53 67 76" fill="none" stroke="#e4f5ff" stroke-width="3" opacity=".65"/>
</g>
${a?star(72,124):`<g data-hat transform="rotate(8 0 51)">${path('M-75 58-68 20Q0-15 70 20L79 56Q0 30-75 58Z','#302f3a')}${Array.from({length:13},(_,i)=>`<ellipse cx="${-69+i*11.5}" cy="${23-Math.sin(i/12*Math.PI)*21}" rx="10" ry="13" fill="url(#p-white)"/>`).join('')}${path('M-77 48Q0 13 78 48L75 60Q0 30-74 60Z','#e9dfd2')}</g><path d="M76 148v19" stroke="#e3c47d"/><path d="m76 164 7 9-7 10-7-10Z" fill="#d8bd7d"/>`}
${a?`<path d="M-27 195v14q27 8 54 0v-14" fill="#252d3c"/><rect x="-8" y="201" width="16" height="17" rx="4" fill="none" stroke="#b2bfcc" stroke-width="3"/>`:''}
</g></g>`;
}
export function arm(id,side){const a=id==='ame';return `<g data-arm="${id}-${side}" stroke="#35435c" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><g data-upper>${path('M-17 0Q-31 40-20 89L20 89Q31 40 17 0Z',a?'url(#p-white)':'url(#p-brown)')}${path('M-20 80Q0 90 20 80L22 99Q0 108-22 99Z',a?'#a8b9cc':'#473b34')}<path d="M-16 26q7 13 2 26M14 31q-7 13 0 22" fill="none" stroke="${a?'#8e9eb3':'#89664b'}"/><g data-fore transform="translate(0 96)">${path('M-18 0-13 86Q0 96 13 86L18 0',a?'url(#p-skin)':'url(#p-brown)')}${path('M-15 77H15V94H-15Z',a?'#303847':'#e7d4b0')}<g data-hand transform="translate(0 92)">${path('M-13 0-16 17-26 27Q-27 33-21 32L-12 25-12 47Q-9 53-5 46L-4 28-2 51Q2 56 5 49L6 28 9 46Q14 51 16 44L16 24 20 36Q26 39 26 33L19 11 12 0Z',a?'#343b4c':'url(#p-skin)')}<path d="M-4 8 0 22M6 7 9 22M14 12 17 24" fill="none" stroke="${a?'#768599':'#bc8e83'}"/></g></g></g></g>`}
