
assertType = require "assertType"
Promise = require "Promise"
asyncFs = require "io/async"
syncFs = require "io/sync"
isType = require "isType"
path = require "path"
Type = require "Type"
log = require "log"

type = Type "Lotus_File"

type.argumentTypes =
  filePath: String

# Initialize after 'argumentTypes' is validated.
type.willBuild -> @initArguments (args) ->

  if not path.isAbsolute args[0]
    throw Error "Expected an absolute path: '#{args[0]}'"

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

type.defineValues

  path: (filePath) -> filePath

  module: (_, mod) -> mod

  extension: -> path.extname @path

  name: -> path.basename @path, @extension

  dir: -> path.relative @module.path, path.dirname @path

  _reading: null

type.definePrototype

  dest: get: ->

    if not @dir.length
      return null

    if @module.src and @path.startsWith @module.src
      src = @module.src
      dest = @module.dest

    else if @module.spec and @path.startsWith @module.spec
      src = @module.spec
      dest = @module.specDest

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
