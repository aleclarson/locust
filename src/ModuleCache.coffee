
Type = require "Type"
path = require "path"
has = require "has"
fs = require "fsx"

Module = require "./Module"

nodeModulesRE = /\/node_modules\//

type = Type "ModuleCache"

type.defineValues

  _modules: Object.create null

  _length: 0

type.defineGetters

  length: -> @_length

type.defineMethods

  has: (modName) ->
    has @_modules, modName

  delete: (modName) ->
    return unless mod = @_modules[modName]
    # TODO: Implement module deletion.
    return mod

  get: (modName, modPath) ->
    return mod if mod = @_modules[modName]
    mod = Module modName, modPath
    @_modules[modName] = mod
    @_length += 1
    return mod

  resolve: (filePath) ->
    root = filePath
    while root isnt "/"
      root = path.dirname root
      configPath = path.join root, "package.json"
      break if fs.exists configPath

    # No 'package.json' was found.
    return null if root is "/"

    # Avoid resolving `node_modules` that are not symlinks.
    if nodeModulesRE.test configPath
      unless fs.isLink path.dirname configPath
        return null

    config = require configPath
    if config.name
    then @_modules[config.name] or null
    else null

  load: (modPath) ->

    if modPath[0] is "."
      modPath = path.resolve modPath

    else unless path.isAbsolute modPath
      modPath = path.resolve lotus.path, modPath

    unless fs.isDir modPath
      throw Error "Module path must be a directory: '#{modPath}'"

    configPath = path.join modPath, "package.json"
    unless fs.isFile configPath
      throw Error "Missing config file: '#{configPath}'"

    config = require configPath
    return @get config.name, modPath

module.exports = type.construct()
