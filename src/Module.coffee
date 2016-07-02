
# TODO: Fix crash when renaming a module directory.

emptyFunction = require "emptyFunction"
SortedArray = require "sorted-array"
assertType = require "assertType"
sortObject = require "sortObject"
Promise = require "Promise"
hasKeys = require "hasKeys"
Tracer = require "tracer"
isType = require "isType"
globby = require "globby"
assert = require "assert"
sync = require "sync"
path = require "path"
Type = require "Type"
log = require "log"
fs = require "io"

type = Type "Lotus_Module"

type.argumentTypes =
  name: String
  path: String

type.initArguments ([ name ]) ->
  assert not Module.cache[name], "Module named '#{name}' already exists!"

type.returnCached (name) ->
  return name

type.defineValues

  name: (name) -> name

  path: (_, path) -> path

  files: -> Object.create null

  _loading: -> Object.create null

  _crawling: -> Object.create null

resolveAbsolutePath = (newValue) ->
  assertType newValue, String
  return newValue if path.isAbsolute newValue
  return path.resolve @path, newValue

type.defineProperties

  # The pattern for source files.
  src:
    value: null
    willSet: resolveAbsolutePath

  # The pattern for test files.
  spec:
    value: null
    willSet: resolveAbsolutePath

  # The directory to put transformed source files.
  dest:
    value: null
    willSet: resolveAbsolutePath

  # The directory to put transformed test files.
  specDest:
    value: null
    willSet: resolveAbsolutePath

type.initInstance ->
  return if not Module._debug
  log.moat 1
  log.green.dim "new Module("
  log.green "\"#{@name}\""
  log.green.dim ")"
  log.moat 1

type.defineMethods

  load: (names) ->

    assertType names, Array

    tracer = Tracer "module.load()"

    return Promise.chain names, (name) =>

      @_loading[name] ?= Promise.try =>
        load = Module._loaders[name]
        assert isType(load, Function), { mod: this, name, reason: "Invalid loader!" }
        load.call this

      .fail (error) =>
        @_loading[name] = null
        throw error

  # Find any files that belong to this module.
  # Use the 'lotus-watch' plugin and call 'Module.watch' if
  # you need to know about added/changed/deleted files.
  crawl: (pattern, options) ->

    if isType pattern, Object
      options = pattern
      pattern = null

    else unless isType options, Object
      options = {}

    # If no pattern is specified, find the
    # compiled source files of this module.
    unless pattern
      pattern = []
      pattern[0] = @path + "/*.js"
      pattern[1] = @dest + "/**/*.js" if @dest

    if Array.isArray pattern

      return Promise.map pattern, (pattern) =>
        @crawl pattern, options

      .then (filesByPattern) ->
        paths = Object.create null
        results = []
        filesByPattern.forEach (files) ->
          files.forEach (file) ->
            return if paths[file.path]
            paths[file.path] = yes
            results.push file
        return results

    assertType pattern, String

    if not path.isAbsolute pattern[0]
      pattern = path.resolve @path, pattern

    if not options.force
      return @_crawling[pattern] if @_crawling[pattern]

    if options.verbose
      log.moat 1
      log.white "crawl "
      log.cyan lotus.relative pattern
      log.moat 1

    @_crawling[pattern] =

      globby pattern, { nodir: yes, ignore: "**/node_modules/**" }

      .then (filePaths) => # TODO: Handle cancellation properly.
        files = []
        for filePath in filePaths
          files.push lotus.File filePath, this
        return files

      .fail (error) =>
        delete @_crawling[pattern]
        throw error

  saveConfig: ->

    return unless @config

    configPath = @path + "/package.json"

    { dependencies, devDependencies } = @config

    if hasKeys dependencies
      @config.dependencies = sortObject dependencies, (a, b) -> if a.key > b.key then 1 else -1
    else delete @config.dependencies

    if hasKeys devDependencies
      @config.devDependencies = sortObject devDependencies, (a, b) -> if a.key > b.key then 1 else -1
    else delete @config.devDependencies

    config = JSON.stringify @config, null, 2
    fs.sync.write configPath, config + log.ln
    return

type.defineStatics

  _debug: no

  _loaders: Object.create null

  _plugins: []

  resolve: (filePath) ->
    filePath = path.relative lotus.path, filePath
    name = filePath.slice 0, filePath.indexOf path.sep
    return Module.cache[name]

  load: (moduleName) ->

    if moduleName[0] is "."
      modulePath = path.resolve process.cwd(), moduleName
      moduleName = path.basename modulePath

    else if path.isAbsolute moduleName
      modulePath = moduleName
      moduleName = lotus.relative modulePath

    else
      modulePath = path.join lotus.path, moduleName

    fs.async.isDir modulePath
    .assert "Module path must be a directory: '#{modulePath}'"

    .then ->
      configPath = path.join modulePath, "package.json"
      fs.async.isFile configPath
      .assert "Missing config file: '#{configPath}'"

    .then ->
      Module.cache[moduleName] or
        Module moduleName, modulePath

  # Find modules in the given directory.
  # Import the 'lotus-watch' plugin and
  # call 'Module.watch' if you need to know
  # about added/changed/deleted modules.
  crawl: (dirPath) ->

    # TODO: Support multiple $LOTUS_PATH
    dirPath ?= lotus.path

    assertType dirPath, String

    if not path.isAbsolute dirPath
      throw Error "Expected an absolute path: '#{dirPath}'"

    if not fs.sync.isDir dirPath
      throw Error "Expected a directory: '#{dirPath}'"

    mods = SortedArray [], (a, b) ->
      a = a.name.toLowerCase()
      b = b.name.toLowerCase()
      if a > b then 1 else -1

    fs.async.readDir dirPath
    .then (children) ->
      Promise.chain children, (moduleName) ->
        Module.load moduleName
        .then (mod) -> mod and mods.insert mod
        .fail emptyFunction # Ignore module errors.
    .then -> mods.array

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

type.addMixins lotus._moduleMixins

module.exports = Module = type.build()

Module.addLoaders

  config: ->

    configPath = @path + "/package.json"

    unless fs.sync.isFile configPath
      error = Error "'package.json' could not be found!"
      return Promise.reject error

    fs.async.read configPath

    .then (json) =>

      @config = JSON.parse json
      config = @config.lotus or {}

      if isType config.src, String
        @src = config.src

      if isType config.spec, String
        @spec = config.spec

      if isType config.dest, String
        @dest = config.dest

      else if isType @config.main, String
        @dest = path.dirname path.join @path, @config.main

      if isType config.specDest, String
        @specDest = config.specDest

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

        Promise.all promises

      .then =>
        plugin.initModule this, config[plugin.name] or {}

      .fail (error) ->
        log.moat 1
        log.red "Plugin error: "
        log.white plugin.name
        log.moat 0
        log.gray.dim error.stack
        log.moat 1
