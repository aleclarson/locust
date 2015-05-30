(function() {
  var File, Finder, NamedFunction, define, exports, io, isAbsolute, isFile, join, log, ref, ref1;

  log = require("lotus-log").log;

  Finder = require("finder");

  define = require("define");

  ref = require("io"), io = ref.io, isFile = ref.isFile;

  ref1 = require("path"), join = ref1.join, isAbsolute = ref1.isAbsolute;

  NamedFunction = require("named-function");

  File = exports = NamedFunction("File", function(path, pkg) {
    if (!(this instanceof File)) {
      return new File(path, pkg);
    }
    if (!isAbsolute(path)) {
      throw Error("'path' must be absolute.");
    }
    if (!isFile.sync(path)) {
      throw Error("'path' must be an existing file.");
    }
    return define(this, function() {
      this.options = {};
      this.configurable = false;
      this({
        isInitialized: false
      });
      this.writable = false;
      return this({
        pkg: pkg,
        path: path,
        dependers: {
          value: {}
        },
        dependencies: {
          value: {}
        }
      });
    });
  });

  define(File.prototype, function() {
    this.options = {
      configurable: false,
      writable: false
    };
    this({
      initialize: function() {
        if (this.isInitialized) {
          return io.resolved();
        }
        this.isInitialized = true;
        return io.all([_findDependencies()]);
      }
    });
    this.enumerable = false;
    return this({
      _findDependencies: function() {
        var find;
        log.moat(1);
        log("Finding the dependencies of ");
        log.pink(this.path);
        log.moat(1);
        find = Finder(/(^|[\(\[\s]+)require(\s|\()("|')([^"']+)("|')/gi);
        find.group = 3;
        return io.read(this.path).then(function(contents) {});
      }
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

//# sourceMappingURL=map/file.js.map
