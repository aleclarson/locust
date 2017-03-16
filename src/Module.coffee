
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
fs = require "fsx"

type = Type "Lotus_Module"

type.defineArgs
  name: String.isRequired
  path: String.isRequired

type.defineValues (name, path) ->

  name: name

  path: path

  files: Object.create null

  _loaders: Object.create null

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

type.initInstance do ->
  defaultLoaders = null
  return ->
    defaultLoaders ?=
      config: @_loadConfig
      plugins: @_loadPlugins
    @addLoaders defaultLoaders

#
# Prototype
#

type.defineMethods

  getFile: (filePath) ->
    return file if file = @files[filePath]
    return null unless mod = lotus.modules.resolve filePath
    @files[filePath] = file = lotus.File filePath, mod
    return file

  load: (names) ->
    assertType names, Array
    Promise.chain names, (name) =>

      @_loading[name] ?= Promise.try =>
        if loader = @_loaders[name]
        then loader.call this
        else throw Error "Loader named '#{name}' does not exist!"

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
          if file = @getFile filePath
            files.push file
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
    fs.writeFile configPath, config + log.ln
    return

  hasPlugin: (plugin) ->
    return inArray @config.plugins, plugin if @config
    throw Error "Must first load the module's config file!"

  addLoader: (key, loader) ->
    if loader instanceof Function
    then @_loaders[key] = loader
    else throw TypeError "Loaders must be functions!"
    return

  addLoaders: (loaders) ->
    assertType loaders, Object
    for key, loader of loaders
      @addLoader key, loader
    return

  _loadConfig: ->

    configPath = path.join @path, "package.json"
    unless fs.isFile configPath
      error = Error "'package.json' could not be found!"
      return Promise.reject error

    @config = JSON.parse fs.readFile configPath

    if isType @config.src, String
      @src = @config.src

    if isType @config.spec, String
      @spec = @config.spec

    if isType @config.dest, String
      @dest = @config.dest

    else if isType @config.main, String
      @dest = path.dirname path.join @path, @config.main
    return

  _loadPlugins: ->

    unless @config
      throw Error "Must load the 'config' first!"

    plugins = new Set

    if names = @config.plugins
      plugins.add name for name in names

    for name in lotus._modulePlugins
      plugins.add name

    loader = (plugin) =>
      plugin.initModule this

    plugins = Array.from plugins
    Promise.all plugins, (name) ->
      lotus.plugins.load name, loader

type.addMixins lotus._moduleMixins

module.exports = Module = type.build()
