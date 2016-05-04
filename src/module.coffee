
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

Config = require "./Config"

type = Type "Lotus_Module"

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

  files: -> {}

  versions: -> {}

  dependers: -> {}

  dependencies: -> {}

  _deleted: no

  _patterns: -> Object.create null

  _loading: null

  _retryWatcher: null

  _reportedMissing: -> {}

type.defineMethods

  load: (options = {}) ->

    return @_loading if @_loading

    @_loading = Q.try =>
      if options.loadConfig isnt no
        @config = Config @path

    .then =>
      if options.loadPlugins isnt no
        @_loadPlugins()

    .fail (error) =>
      @_loading = null
      throw error

  crawl: (pattern, onFileChange) ->

    pattern = Path.join @path, pattern

    if onFileChange
      Module.watch pattern, onFileChange

    if @_patterns[pattern]
      return @_patterns[pattern].adding

    fs = @_patterns[pattern] = chokidar.watch()

    deferred = Q.defer()

    files = Object.create null

    fs.on "add", onAdd = (path) =>
      return unless syncFs.isFile path
      files[path] = lotus.File path, this

    fs.once "ready", =>

      fs.removeListener "add", onAdd

      deferred.fulfill files

      fs.on "all", (event, path) =>
        @_onFileChange event, path

    fs.add pattern
    fs.adding = deferred.promise

  toJSON: ->

    return no unless @_loading

    @_loading.then =>

      config =
        path: @config.path
        json: @config.json

      files = Object.keys @files

      if files.length > 0
        files = sync.map files, (path) =>
          Path.relative @path, path

      # TODO: This is always empty.
      dependers = Object.keys @dependers

      { @name, files, dependers, @dependencies, config }

  _onFileChange: (event, path) ->

    if event is "add"
      return unless syncFs.isFile path

    else unless @files[path]
      log.moat 1
      log.white "Unknown file: "
      log.red path
      log.moat 1
      log.format @files, { maxObjectDepth: 0 }
      log.moat 1
      return

    file = lotus.File path, this

    if event is "unlink"
      file.delete()

    process.nextTick ->
      Module.didFileChange.emit { file, event }

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

    sync.each @dependers, (mod) =>
      delete mod.dependencies[@name]

    sync.each @dependencies, (mod) =>
      delete mod.dependers[@name]

    sync.each @files, (file) ->
      file.delete()

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
    return Module.didFileChange ({ file, event }) ->
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

  fromJSON: (json) ->

    { name, files, dependers, dependencies, config } = json

    return if Module.cache[name]

    mod = Module name

    # TODO Might not want this...
    mod._loading = Q()

    mod.config = Config.fromJSON config.path, config.json
    mod.dependencies = dependencies

    mod.files = sync.reduce files, {}, (files, path) ->
      path = Path.resolve mod.path, path
      files[path] = lotus.File path, mod
      files

    return {
      module: mod
      dependers
    }

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
