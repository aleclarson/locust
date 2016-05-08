
# TODO: Fix crash when renaming a module directory.

SortedArray = require "sorted-array"
inArray = require "in-array"
asyncFs = require "io/async"
syncFs = require "io/sync"
Tracer = require "tracer"
globby = require "globby"
sync = require "sync"
Path = require "path"
Type = require "Type"
Q = require "q"

type = Type "Lotus_Module"

type.argumentTypes =
  name: String
  path: String

type.createArguments (args) ->
  args[1] ?= Path.resolve lotus.path, args[0]
  return args

type.returnCached (name) ->
  return name

type.defineValues

  name: (name) -> name

  path: (_, path) -> path

  files: -> Object.create null

  _loading: -> Object.create null

  _crawling: null

type.defineProperties

  # Where the compiled source files are located.
  dest:
    value: null
    didSet: (newValue) ->
      assertType newValue, String
      assert Path.isAbsolute(newValue), { path: newValue, reason: "'dest' must be an absolute path!" }
      assert syncFs.isDir(newValue), { path: newValue, reason: "'dest' must be an existing directory!" }

  # Where the compiled test files are located.
  specDest:
    value: null
    didSet: (newValue) ->
      assertType newValue, String
      assert Path.isAbsolute(newValue), { path: newValue, reason: "'specDest' must be an absolute path!" }
      assert syncFs.isDir(newValue), { path: newValue, reason: "'specDest' must be an existing directory!" }

type.initInstance ->

  assert @name[0] isnt "/", { mod: this, reason: "Module name cannot begin with '/'!" }
  assert @name[0..1] isnt "./", { mod: this, reason: "Module name cannot begin with './'!" }
  assert syncFs.isDir(@path), { mod: this, reason: "Module path must be a directory!" }
  assert not inArray(lotus.config.ignoredModules, @name), { mod: this, reason: "Module ignored by global config file!" }

  dest = @path + "/js/src"
  @dest = dest if syncFs.isDir dest

  specDest = @path + "/js/spec"
  @specDest = specDest if syncFs.isDir specDest

  if process.options.printModules
    log.moat 1
    log.green.dim "new Module("
    log.green "\"#{@name}\""
    log.green.dim ")"
    log.moat 1

type.defineMethods

  load: (names) ->

    assertType names, Array

    tracer = Tracer "module.load()"

    queue = Q()

    sync.each names, (name) =>

      queue = queue.then =>

        @_loading[name] ?= Q.try =>
          load = Module._loaders[name]
          assert isType(load, Function), { mod: this, name, reason: "Invalid loader!" }
          load.call this

        .fail (error) =>
          @_loading[name] = null
          throwFailure error, { mod: this, name, stack: tracer() }

    return queue

  # Find compiled source files that belong to this module.
  # Use the 'lotus-watch' plugin and call 'Module.watch' if
  # you need to know about added/changed/deleted files.
  crawl: ->

    return @_crawling if @_crawling

    assert @dest, { mod: this, reason: "Can only crawl module when its 'dest' is defined!" }

    @_crawling = globby [
      @path + "/*.js"
      @dest + "/**/*.js"
    ]

    .then (paths) =>

      for path in paths
        lotus.File path, this

      return @files

  saveConfig: ->
    return unless @config
    path = @path + "/package.json"
    json = JSON.stringify @config, null, 2
    syncFs.write path, json
    return

  reportError: (error, options = {}) ->

    assertType @name, String
    assertType error, Error.Kind

    if isType options.warn, Array
      if inArray options.warn, error.message
        log.moat 1
        log.yellow "WARN: "
        log.white @name
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
    log.white @name
    log.moat 0
    log.gray.dim error.stack
    log.moat 1
    return

type.defineStatics

  _loaders: Object.create null

  _plugins: []

  resolvePath: (modulePath) ->

    if modulePath[0] is "."
      modulePath = Path.resolve process.cwd(), modulePath

    else if modulePath[0] isnt "/"
      modulePath = lotus.path + "/" + modulePath

    return modulePath

  forFile: (path) ->
    path = Path.relative lotus.path, path
    name = path.slice 0, path.indexOf "/"
    return Module.cache[name]

  # Find modules in the given directory.
  # Import the 'lotus-watch' plugin and
  # call 'Method.watch' if you need to know
  # about added/changed/deleted modules.
  crawl: (path) ->

    assertType path, String
    assert Path.isAbsolute(path), "Expected an absolute path!"
    assert syncFs.isDir(path), "Expected an existing directory!"

    mods = SortedArray [], (a, b) ->
      a = a.name.toLowerCase()
      b = b.name.toLowerCase()
      if a > b then 1 else -1

    children = syncFs.readDir path
    sync.each children, (moduleName) ->
      modulePath = path + "/" + moduleName
      return unless syncFs.isDir modulePath
      return unless syncFs.isFile modulePath + "/package.json"
      return if Module.cache[moduleName]
      try mods.insert Module moduleName, modulePath
      catch error then Module.reportError moduleName, error, errorConfig.crawl

    return mods.array

  addLoader: (name, loader) ->
    assert not @_loaders[name], "Loader named '#{name}' already exists!"
    @_loaders[name] = loader
    return

  addLoaders: (loaders) ->
    assertType loaders, Object
    for name, loader of loaders
      @addLoader name, loader
    return

  addPlugin: (plugin) ->
    assertType plugin, String
    index = @_plugins.indexOf plugin
    assert index < 0, "Plugin has already been added!"
    @_plugins.push plugin
    return

  reportError: (name, error, options) ->
    Module::reportError.call { name }, error, options

type.addMixins lotus._moduleMixins

module.exports = Module = type.build()

Module.addLoaders

  config: ->

    path = @path + "/package.json"

    unless syncFs.isFile path
      error = Error "'package.json' could not be found!"
      return Q.reject error

    asyncFs.read path

    .then (json) =>

      @config = JSON.parse json

      return unless isType @config.lotus, Object

      { dest, specDest } = @config.lotus

      if isType dest, String
        assert dest[0] isnt "/", "'config.lotus.dest' must be a relative path"
        @dest = Path.resolve @path, dest

      if isType specDest, String
        assert dest[0] isnt "/", "'config.lotus.specDest' must be a relative path"
        @specDest = Path.resolve @path, specDest

  plugins: ->

    config = @config.lotus

    return unless isType config, Object

    plugins = [].concat config.plugins

    if Module._plugins.length
      for name in Module._plugins
        continue if 0 <= plugins.indexOf name
        plugins.push name

    { Plugin } = lotus

    tracer = Tracer "Plugin.load()"

    Plugin.load plugins, (plugin, pluginsLoading) =>

      plugin.load().then ->

        promises = []

        sync.each plugin.globalDependencies, (depName) ->
          assert Plugin._loadedGlobals[depName], { depName, plugin, stack: tracer(), reason: "Missing global plugin dependency!" }

        sync.each plugin.dependencies, (depName) ->
          deferred = pluginsLoading[depName]
          assert deferred, { depName, plugin, stack: tracer(), reason: "Missing local plugin dependency!" }
          promises.push deferred.promise

        Q.all promises

      .then =>
        plugin.initModule this, config[plugin.name] or {}

      .fail (error) ->
        log.moat 1
        log.red "Plugin error: "
        log.white plugin.name
        log.moat 0
        log.gray.dim error.stack
        log.moat 1
        process.exit()

errorConfig =

  crawl:
    quiet: [
      "Module path must be a directory!"
      "Module with that name already exists!"
      "Module ignored by global config file!"
    ]
