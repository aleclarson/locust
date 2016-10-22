
# TODO: Fix crash when renaming a module directory.

emptyFunction = require "emptyFunction"
SortedArray = require "sorted-array"
assertType = require "assertType"
sortObject = require "sortObject"
hasKeys = require "hasKeys"
inArray = require "in-array"
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

      return Promise.all pattern, (pattern) =>
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
      @config.dependencies = sortObject dependencies
    else delete @config.dependencies

    if hasKeys devDependencies
      @config.devDependencies = sortObject devDependencies
    else delete @config.devDependencies

    config = JSON.stringify @config, null, 2
    fs.sync.write configPath, config + log.ln
    return

  hasPlugin: (plugin) ->
    return inArray @config.plugins, plugin if @config
    throw Error "Must first load the module's config file!"

type.defineStatics

  _loaders: Object.create null

  _plugins: []

  has: (moduleName) ->
    moduleCache[moduleName]?

  get: (moduleName, modulePath) ->
    moduleCache[moduleName] ?= Module moduleName, modulePath

  resolve: (filePath) ->
    packageRoot = filePath
    loop
      packageRoot = path.dirname packageRoot
      packageJson = path.join packageRoot, "package.json"
      break if fs.sync.exists packageJson
    name = path.basename packageRoot
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

    if @_loaders[name]
      throw Error "Loader named '#{name}' already exists!"

    @_loaders[name] = loader
    return

  addLoaders: (loaders) ->
    assertType loaders, Object
    for name, loader of loaders
      @addLoader name, loader
    return

  addPlugin: (plugin) ->

    assertType plugin, String

    if 0 <= @_plugins.indexOf plugin
      throw Error "Plugin has already been added!"

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

      try @config = JSON.parse json
      catch error
        throw Error "Failed to parse JSON:\n" + configPath + "\n\n" + error.stack

      if isType @config.src, String
        @src = @config.src

      if isType @config.spec, String
        @spec = @config.spec

      if isType @config.dest, String
        @dest = @config.dest

      else if isType @config.main, String
        @dest = path.dirname path.join @path, @config.main

  plugins: ->

    plugins = []
      .concat @config.plugins or []
      .concat Module._plugins

    mod = this
    lotus.Plugin.load plugins, (plugin) ->
      return plugin.initModule mod
