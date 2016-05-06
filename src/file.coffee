
{ spawn } = require "child_process"

NODE_PATHS = require "node-paths"
asyncFs = require "io/async"
inArray = require "in-array"
syncFs = require "io/sync"
Finder = require "finder"
async = require "async"
Path = require "path"
Type = require "Type"

type = Type "Lotus_File"

type.argumentTypes =
  path: String
  mod: lotus.Module.Maybe

type.createArguments (args) ->
  args[1] ?= lotus.Module.forFile args[0]
  return args

type.initArguments (args) ->

  assert Path.isAbsolute(args[0]),
    reason: "Expected an absolute path!"
    path: args[0]

  assert args[1],
    reason: "This file belongs to an unknown module!"

type.returnExisting (path, mod) ->
  mod.files[path]

type.initInstance (path, mod) ->
  mod.files[path] = this

type.defineValues

  name: (path) -> Path.basename path, Path.extname path

  dir: (path, mod) -> Path.relative mod.path, Path.dirname path

  path: (path) -> path

  module: (_, mod) -> mod

  contents: null

  _loading: null

  _reading: null

type.defineMethods

  read: (options = {}) ->

    if options.force or not @_reading
      @contents = null
      @_reading = asyncFs.read @path
      .then (contents) => @contents = contents

    return @_reading

module.exports = type.build()
