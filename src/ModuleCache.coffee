
Type = require "Type"
path = require "path"
has = require "has"
fs = require "fsx"

Module = require "./Module"

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
    packageRoot = filePath
    loop
      packageRoot = path.dirname packageRoot
      packageJson = path.join packageRoot, "package.json"
      break if fs.exists packageJson
    return @_modules[path.basename packageRoot]

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
