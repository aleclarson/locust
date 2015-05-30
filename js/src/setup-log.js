(function() {
  var Stack, log, merge, ref;

  ref = require("lotus-log"), log = ref.log, Stack = ref.Stack;

  merge = require("merge");

  require("lotus-repl");

  log.repl.transform = "coffee";

  log.cursor.isHidden = true;

  log.clear();

  log.moat(1);

}).call(this);

//# sourceMappingURL=map/setup-log.js.map
