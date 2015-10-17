var lotus;

lotus = require("lotus-require");

if (lotus == null) {
  lotus = {};
}

lotus.log = require("lotus-log");

module.exports = lotus;

Object.defineProperty(global, "_lotus_", {
  get: function() {
    return lotus;
  }
});

//# sourceMappingURL=../../map/src/index.map
