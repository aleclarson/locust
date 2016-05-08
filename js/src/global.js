var KeyBindings, LazyVar, ReactiveVar, define, keys, log, lotus, prompt, repl, sync, values;

lotus = require("./index");

require("isDev");

require("failure/global");

require("type-utils/global");

LazyVar = require("lazy-var");

ReactiveVar = require("reactive-var");

log = require("log");

log.indent = 2;

log.moat(1);

prompt = {
  lazy: function() {
    return require("prompt");
  }
};

repl = {
  lazy: function() {
    return require("repl");
  }
};

values = {
  lotus: lotus,
  log: log,
  LazyVar: LazyVar,
  ReactiveVar: ReactiveVar
};

sync = require("sync");

define = require("define");

define(global, {
  frozen: true
}, sync.map(values, function(value) {
  return {
    value: value
  };
}));

define(global, {
  frozen: true
}, {
  prompt: prompt,
  repl: repl
});

KeyBindings = require("key-bindings");

keys = KeyBindings({
  "c+ctrl": function() {
    log.moat(1);
    log.red("CTRL+C");
    log.moat(1);
    return process.exit();
  },
  "x+ctrl": function() {
    log.moat(1);
    log.red("CTRL+X");
    log.moat(1);
    return process.exit();
  }
});

keys.stream = process.stdin;

//# sourceMappingURL=../../map/src/global.map
