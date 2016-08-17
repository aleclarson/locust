var File, Promise, Type, assertType, asyncFs, isType, log, path, syncFs, type;

assertType = require("assertType");

Promise = require("Promise");

asyncFs = require("io/async");

syncFs = require("io/sync");

isType = require("isType");

path = require("path");

Type = require("Type");

log = require("log");

type = Type("Lotus_File");

type.defineArgs({
  filePath: String.isRequired
});

type.initArgs(function(args) {
  var filePath;
  filePath = args[0];
  if (!path.isAbsolute(filePath)) {
    throw Error("Expected an absolute path: '" + filePath + "'");
  }
  if (args[1] == null) {
    args[1] = lotus.Module.getParent(args[0]);
  }
  return assertType(args[1], lotus.Module, "module");
});

type.returnExisting(function(filePath, mod) {
  return mod.files[filePath];
});

type.initInstance(function(filePath, mod) {
  var fileName;
  mod.files[filePath] = this;
  if (File._debug) {
    fileName = path.join(mod.name, path.relative(mod.path, filePath));
    log.moat(1);
    log.green.dim("new File(");
    log.green("\"" + fileName + "\"");
    log.green.dim(")");
    return log.moat(1);
  }
});

type.defineValues(function(filePath, mod) {
  var ext;
  return {
    path: filePath,
    module: mod,
    extension: ext = path.extname(filePath),
    name: path.basename(filePath, ext),
    dir: path.relative(mod.path, path.dirname(filePath)),
    _reading: null
  };
});

type.defineGetters({
  dest: function() {
    var dest, parents, src;
    if (!this.dir.length) {
      return null;
    }
    if (this.module.spec && this.path.startsWith(this.module.spec)) {
      return null;
    }
    if (this.module.src && this.path.startsWith(this.module.src)) {
      src = this.module.src;
      dest = this.module.dest;
    }
    if (!(src && dest)) {
      return null;
    }
    parents = path.relative(src, path.dirname(this.path));
    return path.join(dest, parents, this.name + ".js");
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

//# sourceMappingURL=map/File.map
