var combine, define, i, len, log, lotus, props, ref;

lotus = require("./index");

lotus.forceAll = true;

require("failure/global");

require("lazy-var");

require("reactive-var");

combine = require("combine");

define = require("define");

log = require("log");

log.indent = 2;

log.moat(1);

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

//# sourceMappingURL=../../map/src/Global.map
