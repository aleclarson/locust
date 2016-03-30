var combine, define, i, len, log, lotus, props, ref;

lotus = require("./index");

lotus.forceAll = true;

log = require("lotus-log");

log.indent = 2;

log.moat(1);

combine = require("combine");

define = require("define");

combine(global, {
  log: log,
  lotus: lotus,
  isDev: require("isDev"),
  emptyFunction: require("emptyFunction"),
  sync: require("sync"),
  Q: require("q")
});

ref = [require("type-utils")];
for (i = 0, len = ref.length; i < len; i++) {
  props = ref[i];
  combine(global, props);
}

define(global, {
  repl: {
    lazy: function() {
      return require("lotus-repl");
    }
  }
});

//# sourceMappingURL=../../map/src/global.map
