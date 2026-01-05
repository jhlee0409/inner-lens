#!/usr/bin/env node
'use strict';

var child_process = require('child_process');
var path = require('path');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefault(path);

var currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
var cliPath = path__default.default.resolve(currentDir, "cli.cjs");
var args = ["init", ...process.argv.slice(2)];
var child = child_process.spawn(process.execPath, [cliPath, ...args], {
  stdio: "inherit",
  cwd: process.cwd()
});
child.on("close", (code) => {
  process.exit(code ?? 0);
});
