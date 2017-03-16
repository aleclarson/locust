
assertType = require "assertType"
isType = require "isType"
path = require "path"
Type = require "Type"
fs = require "fsx"

type = Type "Lotus_File"

type.defineValues (filePath, mod) ->

  assertType filePath, String
  unless path.isAbsolute filePath
    throw Error "Expected an absolute path: '#{filePath}'"

  mod ?= lotus.modules.resolve filePath
  assertType mod, lotus.Module

  path: filePath

  module: mod

  extension: ext = path.extname filePath

  name: path.basename filePath, ext

  dir: path.relative mod.path, path.dirname filePath

  _contents: null

#
# Prototype
#

type.defineGetters

  dest: ->

    unless @dir.length
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

  read: ->
    @_contents ?= fs.readFile @path

  invalidate: ->
    @_contents = null
    return

type.addMixins lotus.fileMixins

module.exports = File = type.build()
