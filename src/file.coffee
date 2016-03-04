
Lotus = require "./index"

{ join, isAbsolute, dirname, basename, extname, relative } = require "path"
{ assert, isKind, setType } = require "type-utils"
{ async, sync } = require "io"
{ spawn } = require "child_process"

NamedFunction = require "named-function"
NODE_PATHS = require "node-paths"
inArray = require "in-array"
Finder = require "finder"
define = require "define"
plural = require "plural"
log = require "lotus-log"

module.exports =
Lotus.File = NamedFunction "File", (path, mod) ->

  mod ?= Lotus.Module.forFile path

  assert mod?, { path, reason: "This file belongs to an unknown module!" }

  file = mod.files[path]
  return file if file?

  mod.files[path] =
  file = setType {}, File

  assert (isAbsolute path), { path, reason: "The file path must be absolute!" }

  name = basename path, extname path
  dir = relative mod.path, dirname path

  # log
  #   .moat 1
  #   .white "File found: "
  #   .gray process.cwd(), "/"
  #   .green relative process.cwd(), path
  #   .moat 1

  define file, ->

    @options = configurable: no
    @
      contents: null
      dependers: {}
      dependencies: {}

    @writable = no
    @ {
      name
      dir
      path
      module: mod
    }

    @options = enumerable: no
    @
      _initializing: null
      _reading: null

define Lotus.File,

  # Used to initialize a File with its JSON representation.
  fromJSON: (file, json) ->

    if json.lastModified?
      file.isInitialized = yes
      file.lastModified = json.lastModified

    async.reduce json.dependers, {}, (dependers, path) ->
      dependers[path] = Lotus.File path
      dependers

    .then (dependers) ->
      file.dependers = dependers

    .then ->
      async.reduce json.dependencies, {}, (dependencies, path) ->
        dependencies[path] = Lotus.File path
        dependencies

    .then (dependencies) ->
      file.dependencies = dependencies
      file

define Lotus.File.prototype, ->
  @options =
    configurable: no
    writable: no
  @
    initialize: ->
      return @_initializing if @_initializing
      @_initializing = async.all [
        @_loadLastModified()
        @_loadDeps()
      ]

    read: (options = {}) ->
      if options.force or not @_reading?
        @contents = null
        @_reading = async.read @path
        .then (contents) => @contents = contents
      @_reading

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

          promise = _installMissing @module, dep.module

          if promise?
            @dependencies[dep.path] = dep
            dep.dependers[@path] = this

          promise

    _loadDep: async.promised (depPath) ->

      return if NODE_PATHS.indexOf(depPath) >= 0

      depFile = Lotus.resolve depPath, @path

      return if depFile is null

      if depPath[0] isnt "." and depPath.indexOf("/") < 0

        mod = Lotus.Module.cache[depPath]

        unless mod?

          try mod = Lotus.Module depPath
          catch error
            # log
            #   .moat 1
            #   .white "Module error: "
            #   .red depPath
            #   .moat 0
            #   .gray (if log.isVerbose then error.stack else error.message)
            #   .moat 1
          return unless mod?

          async.try ->
            mod.initialize()

          .fail (error) ->
            mod._retryInitialize error

        Lotus.File depFile, mod

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

      .then (modName) =>
        mod = Lotus.Module.cache[modName]
        mod ?= Lotus.Module modName
        Lotus.File depFile, mod

##
## HELPERS
##

_findDepPath = Finder
  regex: /(^|[\(\[\s\n]+)require\(("|')([^"']+)("|')/g
  group: 3

_unshiftContext = (fn) -> (context, args...) ->
  fn.apply context, args

_installMissing = _unshiftContext (dep) ->

  if !isKind this, Lotus.Module
    throw TypeError "'this' must be a Lotus.Module"

  if !isKind dep, Lotus.Module
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
