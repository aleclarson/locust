
lotus = require "../../../lotus-require"
io = require "io"
log = require "lotus-log"
Finder = require "finder"
define = require "define"
plural = require "plural"
NamedFunction = require "named-function"
{ isKind } = require "type-utils"
{ spawn } = require "child_process"
{ join, isAbsolute, dirname, basename, relative } = require "path"
NODE_PATHS = require "node-paths"

# This is set lazily in `exports.initialize` as to resolve a circular dependency.
Module = null

File = NamedFunction "File", (path, module) ->

  if (file = module.files[path])?

    if log.isDebug and log.isVerbose
      log.moat 1
      log "File already exists: "
      log.red relative lotus.path, file.path
      log.moat 1

    return file

  unless isKind this, File
    return new File path, module

  unless isAbsolute path
    throw Error "'path' must be absolute."

  if log.isDebug and log.isVerbose
    log.moat 1
    log "File created: "
    log.blue relative lotus.path, path
    log.moat 1

  module.files[path] = this

  define this, ->

    @options = {}
    @configurable = no
    @
      # Has `file.initialize()` been called?
      isInitialized: no

    @writable = no
    @
      # The module that this file belongs to.
      module: module

      # The absolute path to this file.
      path: path

      # A map of files that depend on this file.
      dependers: value: {}

      # A map of files that this file depends on.
      dependencies: value: {}

define File.prototype, ->
  @options =
    configurable: no
    writable: no
  @
    initialize: ->
      return io.fulfill() if @isInitialized
      @isInitialized = yes
      io.all [
        @_loadLastModified()
        @_loadDeps()
      ]

  @enumerable = no
  @
    _loadLastModified: ->

      io.stat @path

      .then (stats) =>
        @lastModified = stats.node.mtime

    _loadDeps: ->

      io.read @path

      .then (contents) =>
        @_parseDeps contents

    _parseDeps: (contents) ->

      depPaths = _findDepPath.all contents

      if log.isDebug and log.isVerbose
        log.moat 1
        _printOrigin()
        log.yellow relative lotus.path, @path
        log " has "
        log.yellow depPaths.length
        log " ", plural "dependency", depPaths.length
        log.moat 1

      io.each depPaths, (depPath) =>

        @_loadDep depPath

        .then (dep) =>

          return unless dep?

          if log.isDebug and log.isVerbose
            log.moat 1
            _printOrigin()
            log.yellow relative lotus.path, @path
            log " depends on "
            log.yellow relative lotus.path, dep.path
            log.moat 1

          promise = _installMissing @module, dep.module

          if promise?
            @dependencies[dep.path] = dep
            dep.dependers[@path] = this

          promise

    _loadDep: io.promised (depPath) ->

      return if NODE_PATHS.indexOf(depPath) >= 0

      depFile = module.abs depPath, dirname @path

      return if depFile is null

      if depPath[0] isnt "." and depPath.indexOf("/") < 0
        return File depFile, Module depPath

      depDir = depFile

      io.loop (done) =>

        newDepDir = dirname depDir

        if newDepDir is "."
          return done depDir

        depDir = newDepDir

        requiredJson = join depDir, "package.json"

        io.isFile requiredJson

        .then (isFile) ->

          return unless isFile

          done basename depDir

      .then (module) =>

        File depFile, Module module

exports.initialize = ->
  Module = arguments[0]
  exports.initialize = -> File
  exports.File = File

##
## HELPERS
##

_findDepPath = Finder
  regex: /(^|[\(\[\s\n]+)require\(("|')([^"']+)("|')/g
  group: 3

_printOrigin = ->
  log.gray.dim "lotus/file "

_unshiftContext = (fn) -> (context, args...) ->
  fn.apply context, args

_installMissing = _unshiftContext (dep) ->

  if !isKind this, Module then throw TypeError "'this' must be a Lotus.Module"

  if !isKind dep, Module then throw TypeError "'dep' must be a Lotus.Module"

  return no if dep is this

  info = require @path + "/package.json"

  return no if info.dependencies? and info.dependencies.hasOwnProperty dep.name

  return no if info.peerDependencies? and info.peerDependencies.hasOwnProperty dep.name

  log.moat 1
  _printOrigin()
  log.yellow @name, " "
  log.bgRed.white "Error"
  log ": "
  log.yellow dep.name
  log " isn't saved as a dependency."
  log.moat 1

  answer = log.prompt.sync label: ->
    log.withIndent 2, -> log.blue "npm install --save "

  log.moat 1

  if answer?

    deferred = io.defer()

    installer = spawn "npm", ["install", "--save", answer],
      stdio: ["ignore", "ignore", "ignore"]
      cwd: @path

    installer.on "exit", deferred.resolve

    deferred.promise

  else null
