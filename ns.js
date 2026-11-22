/* MERMER PRO — storage namespace. Both apps are served from the same origin (twitter67433-oss.github.io), so in a browser they would
   share localStorage/sessionStorage. Every key this copy reads or writes is transparently prefixed "mpro:" → the original
   MERMER TERMİNAL's data (keys, PIN-encrypted secrets, journals, settings) is never read, changed or deleted by MERMER PRO.
   Plain ES5, first script in <head>. If the browser refuses the override, the app still runs but shows a warning flag (window.MPRO_NS=false). */
(function(){
  var PFX = "mpro:", W = window;
  function wrap(S){ if (!S) return S;
    var o = { getItem: function(k){ return S.getItem(PFX + k); }, setItem: function(k, v){ S.setItem(PFX + k, String(v)); }, removeItem: function(k){ S.removeItem(PFX + k); },
      clear: function(){ var ks = [], i; for (i = 0; i < S.length; i++){ var k = S.key(i); if (k && k.indexOf(PFX) === 0) ks.push(k); } for (i = 0; i < ks.length; i++) S.removeItem(ks[i]); },
      key: function(n){ var c = -1, i; for (i = 0; i < S.length; i++){ var k = S.key(i); if (k && k.indexOf(PFX) === 0 && ++c === n) return k.slice(PFX.length); } return null; } };
    Object.defineProperty(o, "length", { get: function(){ var c = 0, i; for (i = 0; i < S.length; i++){ var k = S.key(i); if (k && k.indexOf(PFX) === 0) c++; } return c; } });
    return o; }
  var ok = true;
  ["localStorage", "sessionStorage"].forEach(function(name){
    try { var raw = W[name], ns = wrap(raw); Object.defineProperty(W, name, { configurable: true, enumerable: true, get: function(){ return ns; } });
      if (W[name] !== ns) ok = false; } catch(e){ ok = false; } });
  W.MPRO_NS = ok; W.MPRO_PFX = PFX;
})();
