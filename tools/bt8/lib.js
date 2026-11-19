const fs = require("fs"), R = "/workspace/neon-terminal-mobile/";
const toB = a => a.map(x => ({ t: x[0], T: x[6], o: x[1], h: x[2], l: x[3], c: x[4], v: x[5], tb: x[7], x: true }));
const load = (s, iv) => toB(JSON.parse(fs.readFileSync(`/workspace/r750/data/${s}_${iv}.json`)));
const META = JSON.parse(fs.readFileSync("/workspace/r750/data/syms.json"));
module.exports = { load, META, R };
