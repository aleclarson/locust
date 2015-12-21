
lotus = require "lotus-require"

{ join, isAbsolute, dirname, basename, relative } = require "path"
{ async, sync } = require "io"
NamedFunction = require "named-function"
NODE_PATHS = require "node-paths"
{ isKind } = require "type-utils"
{ spawn } = require "child_process"
inArray = require "in-array"
Finder = require "finder"
define = require "define"
plural = require "plural"
log = require "lotus-log"

# This is set lazily in `exports.initialize` as to resolve a circular dependency.
Module = null

File = NamedFunction "File", (path, module) ->

  module ?= Module.forFile path

  unless module?
    throw TypeError "File '#{path}' belongs to a module not yet cached."

  file = module.files[path]

  return file if file?

  return new File path, module unless isKind this, File

  throw Error "'path' must be absolute." unless isAbsolute path

  if log.isVerbose
    log.moat 1
    log "File created: "
    log.blue relative lotus.path, path
    log.moat 1

  module.files[path] = this

  define this, ->

    @options = configurable: no
    @
      isInitialized: no
      dependers: value: {}
      dependencies: value: {}

    @writable = no
    @ { module, path }

define File,

  # Used to initialize a File with its JSON representation.
  fromJSON: (file, json) ->

    if json.lastModified?
      file.isInitialized = yes
      file.lastModified = json.lastModified

    async.reduce json.dependers, {}, (dependers, path) ->
      dependers[path] = File path
      dependers

    .then (dependers) ->
      file.dependers = dependers

    .then ->
      async.reduce json.dependencies, {}, (dependencies, path) ->
        dependencies[path] = File path
        dependencies

    .then (dependencies) ->
      file.dependencies = dependencies
      file

define File.prototype, ->
  @options =
    configurable: no
    writable: no
  @
    initialize: ->
      return async.fulfill() if @isInitialized
      @isInitialized = yes
      async.all [
        @_loadLastModified()
        @_loadDeps()
      ]

    delete: ->
      if log.isVerbose
        log.moat 1
        log "File deleted: "
        log.moat 0
        log.red @path
        log.moat 1
      delete @module.files[@path]
      # TODO: Delete any references that other modules have to this module.

    toJSON: ->
      dependers = Object.keys @dependers
      dependencies = Object.keys @dependencies
      { @path, dependers, dependencies, @lastModified }

  @enumerable = no
  @
    _loadLastModified: ->

      async.stats @path

      .then (stats) =>
        @lastModified = stats.node.mtime

    _loadDeps: ->

      async.read @path

      .then (contents) =>
        @_parseDeps contents

    _parseDeps: (contents) ->

      depCount = 0

      depPaths = _findDepPath.all contents

      async.each depPaths, (depPath) =>

        @_loadDep depPath

        .then (dep) =>

          return unless dep?

          depCount++

          if log.isDebug and log.isVerbose
            log.origin "lotus/file"
            log.yellow relative lotus.path, @path
            log " depends on "
            log.yellow relative lotus.path, dep.path
            log.moat 1

          promise = _installMissing @module, dep.module

          if promise?
            @dependencies[dep.path] = dep
            dep.dependers[@path] = this

          promise

      .then =>
        if log.isDebug and log.isVerbose
          log.origin "lotus/file"
          log.yellow relative lotus.path, @path
          log " has "
          log.yellow depCount
          log " ", plural "dependency", depCount
          log.moat 1

    _loadDep: async.promised (depPath) ->

      return if NODE_PATHS.indexOf(depPath) >= 0

      depFile = lotus.resolve depPath, @path

      return if depFile is null

      if depPath[0] isnt "." and depPath.indexOf("/") < 0
        return File depFile, Module depPath

      depDir = depFile

      async.loop (done) =>

        newDepDir = dirname depDir

        if newDepDir is "."
          return done depDir

        depDir = newDepDir

        requiredJson = join depDir, "package.json"

        async.isFile requiredJson

        .then (isFile) ->

          return unless isFile

          done basename depDir

      .then (module) =>

        File depFile, Module module

isInitialized = no

define exports,

  initialize: (_Module)->
    unless isInitialized
      isInitialized = yes
      Module = _Module
    File

##
## HELPERS
##

_findDepPath = Finder
  regex: /(^|[\(\[\s\n]+)require\(("|')([^"']+)("|')/g
  group: 3

_unshiftContext = (fn) -> (context, args...) ->
  fn.apply context, args

_installMissing = _unshiftContext (dep) ->

  if !isKind this, Module
    throw TypeError "'this' must be a Lotus.Module"

  if !isKind dep, Module
    throw TypeError "'dep' must be a Lotus.Module"

  if dep is this
    return no

  info = JSON.parse sync.read @path + "/package.json"

  isIgnored =
    (info.dependencies?.hasOwnProperty dep.name) or
    (info.peerDependencies?.hasOwnProperty dep.name) or
    (inArray @config?.implicitDependencies, dep.name)

  if isIgnored
    return no

  log.origin "lotus/file"
  log.yellow @name, " "
  log.bgRed.white "Error"
  log ": "
  log.yellow dep.name
  log " isn't saved as a dependency."
  log.moat 1

  return no if @_reportedMissing[dep.path]

  @_reportedMissing[dep.path] = yes

  # TODO: Re-enable this when the prompt works right.
  #
  # answer = log.prompt.sync label: ->
  #   log.withIndent 2, -> log.blue "npm install --save "
  #
  # log.moat 1
  #
  # if answer?
  #
  #   deferred = async.defer()
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
