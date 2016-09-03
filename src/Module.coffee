
# TODO: Fix crash when renaming a module directory.

emptyFunction = require "emptyFunction"
SortedArray = require "sorted-array"
assertType = require "assertType"
sortObject = require "sortObject"
Promise = require "Promise"
hasKeys = require "hasKeys"
inArray = require "in-array"
Tracer = require "tracer"
isType = require "isType"
globby = require "globby"
sync = require "sync"
path = require "path"
Type = require "Type"
log = require "log"
fs = require "io"

moduleCache = Object.create null

type = Type "Lotus_Module"

type.defineArgs
  name: String.isRequired
  path: String.isRequired

type.initArgs ([ name ]) ->
  return if not moduleCache[name]
  throw Error "Module named '#{name}' already exists!"

type.defineValues (name, path) ->

  name: name

  path: path

  files: Object.create null

  _loading: Object.create null

  _crawling: Object.create null

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

#
# Prototype
#

type.defineMethods

  getFile: (filePath) ->
    @files[filePath] ?= lotus.File filePath

  load: (names) ->

    assertType names, Array

    tracer = Tracer "module.load()"

    return Promise.chain names, (name) =>

      @_loading[name] ?= Promise.try =>
        load = Module._loaders[name]
        assertType load, Function
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

      globby pattern,
        nodir: yes,
        ignore: options.ignore

      .then (filePaths) => # TODO: Handle cancellation properly.
        files = []
        for filePath in filePaths
          files.push @getFile filePath
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

  hasPlugin: (plugin) ->
    return inArray @config.lotus.plugins, plugin if @config
    throw Error "Must first load the module's config file!"

type.defineStatics

  _loaders: Object.create null

  _plugins: []

  has: (moduleName) ->
    moduleCache[moduleName]?

  get: (moduleName, modulePath) ->
    moduleCache[moduleName] ?= Module moduleName, modulePath

  resolve: (filePath) ->
    filePath = path.relative lotus.path, filePath
    name = filePath.slice 0, filePath.indexOf path.sep
    return moduleCache[name]

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
      Module.get moduleName, modulePath

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
    if not @_loaders[name]
      @_loaders[name] = loader
      return
    throw Error "Loader named '#{name}' already exists!"

  addLoaders: (loaders) ->
    assertType loaders, Object
    for name, loader of loaders
      @addLoader name, loader
    return

  addPlugin: (plugin) ->
    assertType plugin, String
    index = @_plugins.indexOf plugin
    @_plugins.push plugin if index < 0
    throw Error "Plugin has already been added!"
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
          return if Plugin._loadedGlobals[depName]
          throw Error "Missing global plugin dependency!"

        sync.each plugin.dependencies, (depName) ->
          if deferred = pluginsLoading[depName]
            promises.push deferred.promise
            return
          throw Error "Missing local plugin dependency!"

        Promise.all promises

      .then =>
        plugin.initModule this

      .fail (error) ->
        log.moat 1
        log.red "Plugin error: "
        log.white plugin.name
        log.moat 0
        log.gray.dim error.stack
        log.moat 1
