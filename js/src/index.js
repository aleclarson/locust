var lotus;

lotus = require("lotus-require");

lotus.log = require("lotus-log");

module.exports = lotus;

Object.defineProperty(global, "_lotus_", {
  get: function() {
    return lotus;
  }
});

//# sourceMappingURL=../../map/src/index.map
