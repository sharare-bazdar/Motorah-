'use strict';
const el=id=>document.getElementById(id);
const places=[
 ['میدان ولیعصر',35.7116,51.4071],['میدان هفت تیر',35.7155,51.4255],
 ['میدان آزادی',35.6997,51.3380],['میدان انقلاب',35.7010,51.3913],
 ['میدان ونک',35.7575,51.4091],['میدان تجریش',35.8052,51.4287],
 ['میدان فردوسی',35.7010,51.4205],['میدان رسالت',35.7387,51.4884],
 ['میدان راه‌آهن',35.6606,51.3977],['میدان صادقیه',35.7215,51.3374]
];
const bounds=L.latLngBounds([35.53,51.04],[35.87,51.65]);
const map=L.map('map',{maxBounds:bounds.pad(.25),minZoom:10,maxZoom:19}).setView([35.711,51.415],14);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
tiles.on('tileerror',()=>el('mapmsg').hidden=false);
tiles.on('tileload',()=>el('mapmsg').hidden=true);
const fields=['from','to'];
const markers={};
let line=null,picking=null,version=0,controller=null;
for(const field of fields){
 const select=el(field);
 places.forEach(([name,lat,lon])=>select.add(new Option(name,[lat,lon].join(','))));
 select.selectedIndex=field==='from'?0:1;
 select.onchange=()=>{reset();drawPins();};
}
function coords(field){return el(field).value.split(',').map(Number);}
function drawPins(){
 fields.forEach(field=>{
  const start=field==='from';
  if(markers[field])markers[field].remove();
  const icon=L.divIcon({className:'pin '+(start?'':'dest'),html:start?'م':'پ',iconSize:[28,28],iconAnchor:[14,14]});
  markers[field]=L.marker(coords(field),{icon}).addTo(map).bindTooltip((start?'مبدأ · ':'مقصد · ')+el(field).selectedOptions[0].text,{direction:'top',offset:[0,-13],permanent:true});
 });
}
function reset(){
 version++;controller?.abort();picking=null;el('go').disabled=false;
 if(line){line.remove();line=null;}
 el('result').hidden=true;el('status').textContent='';map.getContainer().style.cursor='';
}
function assign(field,name,point){
 const select=el(field), value=point.join(',');
 if(!Array.from(select.options).some(o=>o.value===value)){
  select.add(new Option(name,value));
 }
 select.value=value;
}
function fit(){map.fitBounds(L.latLngBounds(coords('from'),coords('to')).pad(.25),{maxZoom:15,padding:[35,45]});}
drawPins();fit();
el('highway').onchange=reset;
el('swap').onclick=()=>{
 const saved=fields.map(f=>[el(f).selectedOptions[0].text,coords(f)]);
 reset();assign('from',...saved[1]);assign('to',...saved[0]);drawPins();fit();
};
function choose(field){
 reset();picking=field;el('status').textContent='نقطهٔ '+(field==='from'?'مبدأ':'مقصد')+' را روی نقشه لمس کن.';
 map.getContainer().style.cursor='crosshair';map.getContainer().scrollIntoView({block:'nearest'});
}
el('pickFrom').onclick=()=>choose('from');el('pickTo').onclick=()=>choose('to');
map.on('click',e=>{
 if(!picking)return;
 if(!bounds.contains(e.latlng)){el('status').textContent='نقطه‌ای در محدودهٔ تهران انتخاب کن.';return;}
 const field=picking;reset();assign(field,'نقطهٔ انتخابی روی نقشه',[e.latlng.lat,e.latlng.lng]);drawPins();
});
el('gps').onclick=()=>{
 reset();const id=version;
 if(!navigator.geolocation){el('status').textContent='این مرورگر موقعیت‌یابی ندارد.';return;}
 el('status').textContent='در حال دریافت موقعیت…';
 navigator.geolocation.getCurrentPosition(p=>{
  if(id!==version)return;
  const point=[p.coords.latitude,p.coords.longitude];
  if(!bounds.contains(point)){el('status').textContent='موقعیت شما خارج از تهران است. مبدأ را روی نقشه انتخاب کن.';return;}
  assign('from','موقعیت من',point);el('status').textContent='مبدأ تنظیم شد.';drawPins();fit();
 },()=>{if(id===version)el('status').textContent='موقعیت دریافت نشد. اجازهٔ دسترسی بده یا مبدأ را روی نقشه انتخاب کن.';},{enableHighAccuracy:true,timeout:12000});
};
function decode(shape){
 let i=0,lat=0,lon=0;const points=[];
 function delta(){
  let value=0,shift=0,b;
  do{if(i>=shape.length||shift>30)throw Error();b=shape.charCodeAt(i++)-63;value|=(b&31)<<shift;shift+=5;}while(b>=32);
  return value&1?~(value>>1):value>>1;
 }
 while(i<shape.length){lat+=delta();lon+=delta();points.push([lat/1e6,lon/1e6]);}
 return points;
}
const format=n=>n.toLocaleString('fa-IR',{maximumFractionDigits:1});
const turns=['','شروع حرکت','شروع حرکت','شروع حرکت','پایان مسیر','پایان مسیر','پایان مسیر','ادامهٔ مسیر','مستقیم','کمی به راست','به راست','پیچ تند به راست','دوربرگردان','دوربرگردان','پیچ تند به چپ','به چپ','کمی به چپ','ورود به رمپ','رمپ سمت راست','رمپ سمت چپ','خروجی راست','خروجی چپ','مستقیم','سمت راست بمان','سمت چپ بمان','ورود به مسیر اصلی','ورود به میدان','خروج از میدان'];
el('go').onclick=async()=>{
 reset();const id=version;
 if(map.distance(coords('from'),coords('to'))<15){el('status').textContent='مبدأ و مقصد خیلی نزدیک‌اند.';return;}
 el('status').textContent='در حال محاسبهٔ مسیر موتور…';el('go').disabled=true;
 const request={locations:fields.map(f=>{const [lat,lon]=coords(f);return {lat,lon};}),costing:'motorcycle',costing_options:{motorcycle:{use_highways:el('highway').checked?0:.5}},units:'kilometers'};
 controller=new AbortController();const active=controller,timer=setTimeout(()=>active.abort(),20000);
 try{
  const response=await fetch('https://valhalla1.openstreetmap.de/route?json='+encodeURIComponent(JSON.stringify(request)),{signal:active.signal});
  if(!response.ok)throw Error();
  const {trip}=await response.json();if(id!==version)return;
  const leg=trip.legs[0],points=decode(leg.shape);if(points.length<2)throw Error();
  line=L.polyline(points,{color:'#206a52',weight:6,opacity:.94}).addTo(map);
  map.fitBounds(line.getBounds(),{padding:[32,42]});
  el('stats').textContent=format(Math.max(1,Math.round(trip.summary.time/60)))+' دقیقه · '+format(trip.summary.length)+' کیلومتر';
  el('steps').replaceChildren(...leg.maneuvers.map(m=>{
   const li=document.createElement('li');
   li.textContent=[turns[m.type]||m.instruction,(m.street_names||[]).join(' / '),m.length>0?format(m.length*1000)+' متر':''].filter(Boolean).join(' · ');return li;
  }));
  el('result').hidden=false;el('status').textContent='زمان تخمینی بدون ترافیک زنده';
 }catch{if(id===version)el('status').textContent='مسیر دریافت نشد. اتصال اینترنت را بررسی کن یا نقطه‌های نزدیک خیابان را انتخاب کن و دوباره تلاش کن.';}
 finally{clearTimeout(timer);if(id===version)el('go').disabled=false;}
};
