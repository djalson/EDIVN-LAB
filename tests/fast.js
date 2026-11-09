#!/usr/bin/env node
/* Palier rapide : `node tests/fast.js` = `node tests/all.js --fast`. */
process.argv.push('--fast'); require('./all.js');
