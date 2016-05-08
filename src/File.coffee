
asyncFs = require "io/async"
syncFs = require "io/sync"
Path = require "path"
Type = require "Type"
Q = require "q"

type = Type "Lotus_File"

type.argumentTypes =
  path: String

type.createArguments (args) ->

  { Module } = lotus

  assert Path.isAbsolute(args[0]), { args, reason: "Expected an absolute path!" }

  args[1] ?= Module.forFile args[0]

  assert isType(args[1], Module), { args, reason: "This file belongs to an unknown module!" }

  return args

type.returnExisting (path, mod) -> mod.files[path]

type.initInstance (path, mod) ->

  mod.files[path] = this

  if process.options.printFiles
    fileName = mod.name + "/" + Path.relative mod.path, path
    log.moat 1
    log.green.dim "new File("
    log.green "\"#{fileName}\""
    log.green.dim ")"
    log.moat 1

type.defineValues

  path: (path) -> path

  module: (path, mod) -> mod

  extension: -> Path.extname @path

  name: -> Path.basename @path, @extension

  dir: -> Path.relative @module.path, Path.dirname @path

  _reading: null

type.defineProperties

  dest: get: ->

    if @type is "src"
      destRoot = @module.dest
    else destRoot = @module.specDest

    relPath = Path.relative destRoot, @path

    # This file is already in the destination directory.
    return @path if relPath[1] isnt "."

    srcRoot = Path.join @module.path, "src" # TODO: Replace "src" with dynamic value.
    relDir = Path.relative srcRoot, Path.dirname @path

    Path.join destRoot, relDir, @name + ".js"

  type: get: ->
    return "src" if /[\/]*src[\/]*/.test @dir
    return "spec" if /[\/]*spec[\/]*/.test @dir
    error = Error "Unknown file type!"
    throwFailure error, { file: this }

type.defineMethods

  read: (options = {}) ->

    if options.force or not @_reading
      @_reading = if options.sync
        Q.fulfill syncFs.read @path
      else asyncFs.read @path

    if options.sync
      return @_reading.inspect().value
    return @_reading

type.addMixins lotus._fileMixins

module.exports = type.build()
