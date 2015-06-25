
# TODO: Fix crash when renaming a module directory.

SortedArray = require "sorted-array"
chokidar = require "chokidar"
inArray = require "in-array"
syncFs = require "io/sync"
plural = require "plural"
match = require "micromatch"
Event = require "event"
Path = require "path"
Type = require "Type"
Q = require "q"

Config = require "./Config"

type = Type "Lotus_Module"

type.argumentTypes =
  name: String
  path: String

type.createArguments (args) ->
  args[1] = Path.resolve lotus.path, args[0]
  return args

type.initInstance (name, path) ->

  assert not Module.cache[name],
    reason: "Module with that name already exists!"
    name: name

  assert name[0] isnt "/",
    reason: "Module name cannot begin with '/'!"
    name: name

  assert name[0..1] isnt "./",
    reason: "Module name cannot begin with './'!"
    name: name

  assert syncFs.isDir(path),
    reason: "Module path must be a directory!"
    path: path

  assert not inArray(GlobalConfig.json.ignoredModules, name),
    reason: "Module ignored by global config file!"
    name: name
    path: path

type.returnCached (name) ->
  return name

type.defineValues

  name: (name) -> name

  path: (_, path) -> path

  files: -> Object.create null

  _deleted: no

  _patterns: -> Object.create null

  _loading: null

  _retryWatcher: null

  _reportedMissing: -> {}

type.defineMethods

  load: (options = {}) ->

    return @_loading if @_loading

    @_loading = Q.try =>
      return if options.skipConfig
      @config = Config @path
      return

    .then =>
      return if options.skipPlugins
      @_loadPlugins()

    .fail (error) =>
      @_loading = null
      throw error

  crawl: (pattern, onFileChange) ->

    pattern = Path.join @path, pattern

    if onFileChange
      Module.watch pattern, onFileChange

    fs = @_patterns[pattern]
    return fs.adding if fs

    deferred = Q.defer()

    fs = chokidar.watch()
    files = Object.create null

    onFileAdded = (path) =>
      return unless syncFs.isFile path
      files[path] = lotus.File path, this

    onceFilesReady = =>
      fs.removeListener "add", onFileAdded
      deferred.fulfill files
      fs.on "all", (event, path) =>
        file = lotus.File path, this
        Module.didFileChange.emit event, file

    fs.on "add", onFileAdded
    fs.once "ready", onceFilesReady

    fs.add pattern
    fs.adding = deferred.promise

  _retryLoad: (error) ->
    return if @_deleted
    reportModuleError @name, error, knownErrors.load
    return if @_retryWatcher
    @_retryWatcher = chokidar.watch @path, { depth: 1 }
    @_retryWatcher.once "ready", =>
      @_retryWatcher.on "all", (event, path) =>
        Q.try =>
          @load()
        .then =>
          return unless @_retryWatcher?
          @_retryWatcher.close()
          @_retryWatcher = null
        .fail (error) =>
          @_retryLoad error
    return

  _delete: ->

    return if @_deleted
    @_deleted = yes

    if @_retryWatcher?
      @_retryWatcher.close()
      @_retryWatcher = null

    delete Module.cache[@name]

  _loadPlugins: ->

    pluginNames = [].concat lotus.Plugin.injectedPlugins

    if @config.plugins
      for name in @config.plugins
        pluginNames.push lotus.Plugin name

    if pluginNames.length is 0
      return Q()

    failedPlugin = null

    Q.all pluginNames.map (pluginName) =>

      if isType pluginName, lotus.Plugin
        plugin = pluginName

      else
        plugin = lotus.Plugin pluginName

      Q.try =>
        options = @config.json[plugin.name] or {}
        plugin.initModule this, options

      .fail (error) ->
        return if failedPlugin
        failedPlugin = plugin
        throw error

    .fail (error) =>
      log.moat 1
      log.red "Plugin failed: "
      log.white failedPlugin.name
      log.gray.dim " for module "
      log.cyan @name
      log.moat 0
      log.gray.dim error.stack
      log.moat 1
      process.exit()

type.defineStatics

  didFileChange: Event()

  # Watch the files that match the given 'pattern'.
  # Only the files that have been registered via 'module.watch()' will be used.
  watch: (options, callback) ->
    options = include: options if isType options, String
    options.include ?= "**/*"
    return Module.didFileChange (event, file) ->
      return if match(file.path, options.include).length is 0
      return if options.exclude? and match(file.path, options.exclude).length > 0
      callback file, event, options

  crawl: (dir, options) ->

    assert not Module.fs,
      reason: "Cannot call 'Module.crawl' more than once!"

    promises = []
    newModules = SortedArray [], (a, b) ->
      a = a.name.toLowerCase()
      b = b.name.toLowerCase()
      if a > b then 1 else -1

    Module.fs = fs = chokidar.watch dir, { depth: 0 }

    fs.on "addDir", (path) ->

      return if path is lotus.path

      name = Path.relative lotus.path, path

      promise = Q.try ->

        return if Module.cache[name]

        mod = Module name

        mod.load options

        .then ->
          newModules.insert mod

        .fail (error) ->
          mod._retryLoad error
          return

      .fail (error) ->
        reportModuleError name, error, knownErrors.init

      promises.push promise

    fs.on "unlinkDir", (path) ->
      name = Path.relative lotus.path, path
      Module.cache[name]?._delete()

    deferred = Q.defer()

    fs.once "ready", ->
      Q.all promises
      .then -> deferred.resolve newModules.array
      .done()

    return deferred.promise

  forFile: (path) ->
    path = Path.relative lotus.path, path
    name = path.slice 0, path.indexOf "/"
    return Module.cache[name]

module.exports = Module = type.build()

reportModuleError = (moduleName, error, options = {}) ->

  assertType moduleName, String
  assertType error, Error.Kind

  if isType options.warn, Array
    if inArray options.warn, error.message
      log.moat 1
      log.yellow "WARN: "
      log.white moduleName
      log.moat 0
      log.gray.dim error.message
      log.moat 1
      error.catch?()
      return

  if isType options.quiet, Array
    if inArray options.quiet, error.message
      error.catch?()
      return

  log.moat 1
  log.red "ERROR: "
  log.white moduleName
  log.moat 0
  log.gray.dim error.stack
  log.moat 1
  return

knownErrors =

  init:
    quiet: [
      "Module path must be a directory!"
      "Module with that name already exists!"
      "Module ignored by global config file!"
    ]

  load:
    quiet: [
      "Expected an existing directory!"
      "Failed to find configuration file!"
    ]
