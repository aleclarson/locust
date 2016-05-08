var Path, Q, Type, asyncFs, syncFs, type;

asyncFs = require("io/async");

syncFs = require("io/sync");

Path = require("path");

Type = require("Type");

Q = require("q");

type = Type("Lotus_File");

type.argumentTypes = {
  path: String
};

type.createArguments(function(args) {
  var Module;
  Module = lotus.Module;
  assert(Path.isAbsolute(args[0]), {
    args: args,
    reason: "Expected an absolute path!"
  });
  if (args[1] == null) {
    args[1] = Module.forFile(args[0]);
  }
  assert(isType(args[1], Module), {
    args: args,
    reason: "This file belongs to an unknown module!"
  });
  return args;
});

type.returnExisting(function(path, mod) {
  return mod.files[path];
});

type.initInstance(function(path, mod) {
  var fileName;
  mod.files[path] = this;
  if (process.options.printFiles) {
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
      var destRoot, relDir, relPath, srcRoot;
      if (this.type === "src") {
        destRoot = this.module.dest;
      } else {
        destRoot = this.module.specDest;
      }
      relPath = Path.relative(destRoot, this.path);
      if (relPath[1] !== ".") {
        return this.path;
      }
      srcRoot = Path.join(this.module.path, "src");
      relDir = Path.relative(srcRoot, Path.dirname(this.path));
      return Path.join(destRoot, relDir, this.name + ".js");
    }
  },
  type: {
    get: function() {
      var error;
      if (/[\/]*src[\/]*/.test(this.dir)) {
        return "src";
      }
      if (/[\/]*spec[\/]*/.test(this.dir)) {
        return "spec";
      }
      error = Error("Unknown file type!");
      return throwFailure(error, {
        file: this
      });
    }
  }
});

type.defineMethods({
  read: function(options) {
    if (options == null) {
      options = {};
    }
    if (options.force || !this._reading) {
      this._reading = options.sync ? Q.fulfill(syncFs.read(this.path)) : asyncFs.read(this.path);
    }
    if (options.sync) {
      return this._reading.inspect().value;
    }
    return this._reading;
  }
});

type.addMixins(lotus._fileMixins);

module.exports = type.build();

//# sourceMappingURL=../../map/src/File.map
