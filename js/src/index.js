(function() {
  var define, exports;

  define = require("define");

  exports = require("../../../lotus-require");

  define(exports, function() {
    this.options = {
      configurable: false,
      writable: false
    };
    return this({
      log: {
        lazy: function() {
          return require("lotus-log");
        }
      },
      Module: require("./module"),
      File: require("./file")
    });
  });

  define(module, function() {
    this.options = {
      configurable: false,
      writable: false
    };
    return this({
      exports: exports
    });
  });

}).call(this);

//# sourceMappingURL=map/index.js.map
