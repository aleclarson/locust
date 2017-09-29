
Type = require "Type"
path = require "path"
has = require "has"
fs = require "fsx"

Module = require "./Module"

nodeModulesRE = /\/node_modules\//

type = Type "ModuleCache"

type.defineValues

  _modules: Object.create null

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
    then @_modules[config.name]
    else null

  load: (modName) ->

    if modName[0] is "."
      modPath = path.resolve process.cwd(), modName
      modName = path.basename modPath

    else if path.isAbsolute modName
      modPath = modName
      modName = path.basename modPath

    else
      modPath = path.join lotus.path, modName

    unless fs.isDir modPath
      throw Error "Module path must be a directory: '#{modPath}'"

    configPath = path.join modPath, "package.json"
    unless fs.isFile configPath
      throw Error "Missing config file: '#{configPath}'"

    return @get modName, modPath

module.exports = type.construct()
