// Work in illustration pixels: both axes always use the same display scale.
export function portraitRenderer(image,pair=false){
 const surface=document.createElement('canvas');surface.width=pair?768:512;surface.height=pair?512:684;
 const gl=surface.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
 if(!gl)return null;
 const program=gl.createProgram(),shaders=[];
 function shader(kind,code){const s=gl.createShader(kind);shaders.push(s);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s)}
 shader(gl.VERTEX_SHADER,'attribute vec2 pos;varying vec2 uv;void main(){uv=vec2((pos.x+1.)*.5,(1.-pos.y)*.5);gl_Position=vec4(pos,0.,1.);}');
 shader(gl.FRAGMENT_SHADER,`precision highp float;varying vec2 uv;uniform sampler2D art;uniform float actor,blink,mouth,hair,lift,nod;uniform vec4 faces,details;
 float bell(vec2 p,vec2 c,vec2 r){vec2 v=(p-c)/r;return exp(-dot(v,v)*2.);}
 void fold(inout vec2 p,vec2 c,float amt,vec2 size){vec2 d=p-c;float k=bell(p,c,size);p.y+=d.y*amt*k;}
 void main(){
 ${pair?`
 vec2 p=uv*vec2(1536.,1024.);
 vec2 left=vec2(470.,268.),right=vec2(1120.,395.);
 p.y-=faces.y*bell(p,left,vec2(165.,165.))+faces.w*bell(p,right,vec2(170.,170.));
 p.x+=faces.y*.28*bell(p,left,vec2(165.,165.))-faces.w*.28*bell(p,right,vec2(170.,170.));
 fold(p,vec2(525.,296.),faces.x*10.,vec2(39.,39.));
 fold(p,vec2(1075.,438.),faces.z*10.,vec2(38.,36.));
 fold(p,vec2(1170.,414.),faces.z*10.,vec2(42.,36.));
 fold(p,vec2(466.,369.),details.x,vec2(55.,43.));
 fold(p,vec2(1139.,488.),details.z,vec2(52.,42.));
 p.x-=details.y*bell(p,vec2(415.,178.),vec2(155.,115.));
 p.x-=details.w*bell(p,vec2(1130.,315.),vec2(137.,83.));
 gl_FragColor=texture2D(art,p/vec2(1536.,1024.));`:`
 vec2 p=uv*vec2(768.,1024.);float i=actor;
 vec2 palm=mix(vec2(680.,547.),vec2(181.,560.),i);
 float arm=bell(p,palm,vec2(235.,260.));p.y+=lift*arm;p.x-=(1.-2.*i)*lift*.18*arm;
 vec2 scalp=mix(vec2(300.,235.),vec2(530.,266.),i);
 p.x-=hair*bell(p,scalp,vec2(224.,200.));p.y-=nod*bell(p,scalp,vec2(230.,260.));
 if(i<.5){fold(p,vec2(401.,300.),blink*12.,vec2(37.,40.));}
 else{fold(p,vec2(473.,372.),blink*12.,vec2(42.,40.));fold(p,vec2(586.,337.),blink*12.,vec2(42.,40.));}
 fold(p,mix(vec2(334.,373.),vec2(550.,429.),i),mouth*2.8,vec2(40.,43.));
 gl_FragColor=texture2D(art,vec2((clamp(p.x,0.5,767.5)+768.*i)/1536.,clamp(p.y,.5,1023.5)/1024.));
 `}
 }`);
 gl.linkProgram(program);gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 for(const v of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,v,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
 const names=['actor','blink','mouth','hair','lift','nod'],uniforms=names.map(n=>gl.getUniformLocation(program,n));
 const faces=gl.getUniformLocation(program,'faces'),details=gl.getUniformLocation(program,'details');
 return {draw(i,p,lift){[i,p.blink,1-p.mouth,p.hair*155,lift,p.head*100].forEach((v,j)=>gl.uniform1f(uniforms[j],v));gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return surface},
 drawPair(a,b){gl.uniform4f(faces,a.blink,a.greet*17,b.blink,b.greet*17);gl.uniform4f(details,(1-a.mouth)*2.2,a.hair*245,(1-b.mouth)*2.2,b.hair*245);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return surface},
 dispose(){gl.deleteTexture(tex);gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl.getExtension('WEBGL_lose_context')?.loseContext()}};
}
