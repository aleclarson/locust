
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
  return mod.files[path]

type.initInstance (path, mod) ->
  mod.files[path] = this

type.defineValues

  name: (path) -> Path.basename path, Path.extname path

  dir: (path, mod) -> Path.relative mod.path, Path.dirname path

  path: (path) -> path

  module: (_, mod) -> mod

  contents: null

  dependers: -> {}

  dependencies: -> {}

  _loading: null

  _reading: null

type.defineMethods

  load: ->
    return Q()

    # if @_loading
    #   return @_loading
    #
    # TODO: Make these extensible.
    # TODO: Use the LazyLoader type to let plugins handle which data is needed!
    # return @_loading = Q.all [
    #   @_loadLastModified()
    #   @_loadDeps()
    # ]

  read: (options = {}) ->

    if options.force or not @_reading?
      @contents = null
      @_reading = asyncFs.read @path
      .then (contents) => @contents = contents

    return @_reading

  delete: ->

    sync.each @dependers, (file) =>
      delete file.dependencies[@path]

    sync.each @dependencies, (file) =>
      delete file.dependers[@path]

    delete @module.files[@path]

  toJSON: ->
    dependers = Object.keys @dependers
    dependencies = Object.keys @dependencies
    { @path, dependers, dependencies, @lastModified }

  _loadLastModified: ->

    asyncFs.stats @path

    .then (stats) =>
      @lastModified = stats.node.mtime

  _loadDeps: ->

    asyncFs.read @path

    .then (contents) =>
      @_parseDeps contents

  _parseDeps: (contents) ->

    depCount = 0

    depPaths = _findDepPath.all contents

    Q.all sync.map depPaths, (depPath) =>

      @_loadDep depPath

      .then (dep) =>

        return unless dep?

        depCount++

        promise = _installMissing @module, dep.module

        if promise?
          @dependencies[dep.path] = dep
          dep.dependers[@path] = this

        promise

  _loadDep: Q.fbind (depPath) ->

    return if NODE_PATHS.indexOf(depPath) >= 0

    depFile = lotus.resolve depPath, @path

    return if depFile is null

    if depPath[0] isnt "." and depPath.indexOf("/") < 0

      mod = lotus.Module.cache[depPath]

      unless mod

        try mod = lotus.Module depPath
        catch error then error.catch?()

        return unless mod

        Q.try ->
          mod.load()

        .fail (error) ->
          mod._retryLoad error

      lotus.File depFile, mod

    depDir = depFile

    async.loop (done) =>

      newDepDir = Path.dirname depDir

      if newDepDir is "."
        return done depDir

      depDir = newDepDir

      requiredJson = Path.join depDir, "package.json"

      asyncFs.isFile requiredJson

      .then (isFile) ->

        return unless isFile

        done Path.basename depDir

    .then (modName) =>
      mod = lotus.Module.cache[modName]
      mod ?= lotus.Module modName
      lotus.File depFile, mod

type.defineStatics

  # Used to initialize a File with its JSON representation.
  fromJSON: (file, json) ->

    if json.lastModified?
      file.isInitialized = yes
      file.lastModified = json.lastModified

    Q.try ->
      file.dependers = sync.reduce json.dependers, {}, (dependers, path) ->
        depender = _getFile path
        dependers[path] = depender if depender
        dependers

    .then ->
      file.dependencies = sync.reduce json.dependencies, {}, (dependencies, path) ->
        dependency = _getFile path
        dependencies[path] = dependency if dependency
        dependencies

    .then ->
      return file

module.exports = type.build()

##
## HELPERS
##

_ignoredErrors =

  getFile: [
    "This file belongs to an unknown module!"
  ]

_getFile = (path) ->
  try file = lotus.File path
  catch error
    return unless inArray _ignoredErrors.getFile, error.message
    throw error
  return file

_findDepPath = Finder
  regex: /(^|[\(\[\s\n]+)require\(("|')([^"']+)("|')/g
  group: 3

_unshiftContext = (fn) -> (context, args...) ->
  fn.apply context, args

_installMissing = _unshiftContext (dep) ->

  if !isKind this, lotus.Module
    throw TypeError "'this' must be a Lotus_Module"

  if !isKind dep, lotus.Module
    throw TypeError "'dep' must be a Lotus_Module"

  if dep is this
    return no

  info = JSON.parse syncFs.read @path + "/package.json"

  isIgnored =
    (info.dependencies?.hasOwnProperty dep.name) or
    (info.peerDependencies?.hasOwnProperty dep.name) or
    (inArray @config?.implicitDependencies, dep.name)

  if isIgnored
    return no

  if @_reportedMissing[dep.name]
    return no

  @_reportedMissing[dep.name] = yes

  # TODO: Re-enable this when the prompt works right.
  #
  # answer = log.prompt.sync label: ->
  #   log.withIndent 2, -> log.blue "npm install --save "
  #
  # log.moat 1
  #
  # if answer?
  #
  #   deferred = Q.defer()
  #
  #   installer = spawn "npm", ["install", "--save", answer],
  #     stdio: ["ignore", "ignore", "ignore"]
  #     cwd: @path
  #
  #   installer.on "exit", =>
  #     log.origin "lotus/file"
  #     log.yellow @name
  #     log " installed "
  #     log.yellow dep.name
  #     log " successfully!"
  #     log.moat 1
  #     deferred.resolve()
  #
  #   return deferred.promise

  null
