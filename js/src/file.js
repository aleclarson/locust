var Finder, NODE_PATHS, Path, Type, async, asyncFs, inArray, spawn, syncFs, type;

spawn = require("child_process").spawn;

NODE_PATHS = require("node-paths");

asyncFs = require("io/async");

inArray = require("in-array");

syncFs = require("io/sync");

Finder = require("finder");

async = require("async");

Path = require("path");

Type = require("Type");

type = Type("Lotus_File");

type.argumentTypes = {
  path: String,
  mod: lotus.Module.Maybe
};

type.createArguments(function(args) {
  if (args[1] == null) {
    args[1] = lotus.Module.forFile(args[0]);
  }
  return args;
});

type.initArguments(function(args) {
  assert(Path.isAbsolute(args[0]), {
    reason: "Expected an absolute path!",
    path: args[0]
  });
  return assert(args[1], {
    reason: "This file belongs to an unknown module!"
  });
});

type.returnExisting(function(path, mod) {
  return mod.files[path];
});

type.initInstance(function(path, mod) {
  return mod.files[path] = this;
});

type.defineValues({
  name: function(path) {
    return Path.basename(path, Path.extname(path));
  },
  dir: function(path, mod) {
    return Path.relative(mod.path, Path.dirname(path));
  },
  path: function(path) {
    return path;
  },
  module: function(_, mod) {
    return mod;
  },
  contents: null,
  _loading: null,
  _reading: null
});

type.defineMethods({
  read: function(options) {
    if (options == null) {
      options = {};
    }
    if (options.force || !this._reading) {
      this.contents = null;
      this._reading = asyncFs.read(this.path).then((function(_this) {
        return function(contents) {
          return _this.contents = contents;
        };
      })(this));
    }
    return this._reading;
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/file.map
