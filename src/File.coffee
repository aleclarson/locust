
assertType = require "assertType"
Promise = require "Promise"
asyncFs = require "io/async"
syncFs = require "io/sync"
isType = require "isType"
path = require "path"
Type = require "Type"
log = require "log"

type = Type "Lotus_File"

type.defineArgs
  filePath: String.isRequired

type.initArgs (args) ->
  [filePath] = args

  if not path.isAbsolute filePath
    throw Error "Expected an absolute path: '#{filePath}'"

  args[1] ?= lotus.Module.getParent args[0]
  assertType args[1], lotus.Module, "module"

type.returnExisting (filePath, mod) -> mod.files[filePath]

type.initInstance (filePath, mod) ->

  mod.files[filePath] = this

  if File._debug
    fileName = path.join mod.name, path.relative mod.path, filePath
    log.moat 1
    log.green.dim "new File("
    log.green "\"#{fileName}\""
    log.green.dim ")"
    log.moat 1

type.defineValues (filePath, mod) ->

  path: filePath

  module: mod

  extension: ext = path.extname filePath

  name: path.basename filePath, ext

  dir: path.relative mod.path, path.dirname filePath

  _reading: null

type.defineGetters

  dest: ->

    if not @dir.length
      return null

    # Test files are compiled on-the-fly.
    if @module.spec and @path.startsWith @module.spec
      return null

    if @module.src and @path.startsWith @module.src
      src = @module.src
      dest = @module.dest

    unless src and dest
      return null

    parents = path.relative src, path.dirname @path
    return path.join dest, parents, @name + ".js"

type.defineMethods

  read: (options = {}) ->

    if options.force or not @_reading
      @_reading = if options.sync
        Promise syncFs.read @path
      else asyncFs.read @path

    if options.sync
      return @_reading.inspect().value
    return @_reading

type.defineStatics { _debug: no }

type.addMixins lotus._fileMixins

module.exports = File = type.build()
