var File, Path, Promise, Type, assert, asyncFs, isType, log, syncFs, type;

Promise = require("Promise");

asyncFs = require("io/async");

syncFs = require("io/sync");

isType = require("isType");

assert = require("assert");

Path = require("path");

Type = require("Type");

log = require("log");

type = Type("Lotus_File");

type.argumentTypes = {
  path: String
};

type.willBuild(function() {
  return this.initArguments(function(args) {
    var Module;
    Module = lotus.Module;
    assert(Path.isAbsolute(args[0]), {
      args: args,
      reason: "Expected an absolute path!"
    });
    if (args[1] == null) {
      args[1] = Module.getParent(args[0]);
    }
    return assert(isType(args[1], Module), {
      args: args,
      reason: "This file belongs to an unknown module!"
    });
  });
});

type.returnExisting(function(path, mod) {
  return mod.files[path];
});

type.initInstance(function(path, mod) {
  var fileName;
  mod.files[path] = this;
  if (File._debug) {
    fileName = mod.name + "/" + Path.relative(mod.path, path);
    log.moat(1);
    log.green.dim("new File(");
    log.green("\"" + fileName + "\"");
    log.green.dim(")");
    return log.moat(1);
  }
});

type.defineValues({
  path: function(path) {
    return path;
  },
  module: function(path, mod) {
    return mod;
  },
  extension: function() {
    return Path.extname(this.path);
  },
  name: function() {
    return Path.basename(this.path, this.extension);
  },
  dir: function() {
    return Path.relative(this.module.path, Path.dirname(this.path));
  },
  _reading: null
});

type.defineProperties({
  dest: {
    get: function() {
      var destRoot, destRootToDir, relDir, relPath, srcRoot;
      if (!this.dir.length) {
        return null;
      }
      destRoot = this.type === "src" ? this.module.dest : this.module.specDest;
      if (!destRoot) {
        return null;
      }
      destRootToDir = Path.relative(destRoot, Path.join(this.module.path, this.dir));
      if (destRootToDir[0] !== ".") {
        return null;
      }
      if (!destRoot) {
        log.moat(1);
        log.yellow("Warning: ");
        log.white(this.path);
        log.moat(0);
        log.gray.dim("'file.dest' is not defined!");
        log.moat(0);
        log.gray("{ type: " + this.type + " }");
        log.moat(1);
        return null;
      }
      relPath = Path.relative(destRoot, this.path);
      if (relPath[1] !== ".") {
        return this.path;
      }
      srcRoot = Path.join(this.module.path, "src");
      if (this.path) {
        relDir = Path.relative(srcRoot, Path.dirname(this.path));
      }
      return Path.join(destRoot, relDir, this.name + ".js");
    }
  },
  type: {
    get: function() {
      if (/[\/]*spec[\/]*/.test(this.dir)) {
        return "spec";
      }
      return "src";
    }
  }
});

type.defineMethods({
  read: function(options) {
    if (options == null) {
      options = {};
    }
    if (options.force || !this._reading) {
      this._reading = options.sync ? Promise(syncFs.read(this.path)) : asyncFs.read(this.path);
    }
    if (options.sync) {
      return this._reading.inspect().value;
    }
    return this._reading;
  }
});

type.defineStatics({
  _debug: false
});

type.addMixins(lotus._fileMixins);

module.exports = File = type.build();

//# sourceMappingURL=../../map/src/File.map
