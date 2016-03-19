var combine, define, i, len, lotus, props, ref;

lotus = require("lotus-require");

lotus.forceAll = true;

combine = require("combine");

define = require("define");

define(global, {
  repl: {
    lazy: function() {
      return require("lotus-repl");
    }
  }
});

combine(global, {
  lotus: lotus,
  log: require("lotus-log"),
  emptyFunction: require("emptyFunction")
});

ref = [require("type-utils"), require("io")];
for (i = 0, len = ref.length; i < len; i++) {
  props = ref[i];
  combine(global, props);
}

combine(global, {
  File: require("./File"),
  Module: require("./Module")
});

//# sourceMappingURL=../../map/src/global.map
