
# TODO: Support renaming a module directory.

assertType = require "assertType"
sortObject = require "sortObject"
hasKeys = require "hasKeys"
inArray = require "in-array"
isType = require "isType"
globby = require "globby"
path = require "path"
Type = require "Type"
fs = require "fsx"

type = Type "Lotus_Module"

type.defineArgs [String, String.Maybe]

type.defineValues (modName, modPath) ->

  name: modName

  path: modPath ? path.resolve lotus.path, modName

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

    unless path.isAbsolute filePath
      filePath = path.resolve @path, filePath

    if file = @files[filePath]
      return file

    unless mod = lotus.modules.resolve filePath
      return null

    @files[filePath] = file = lotus.File filePath, mod
    return file

  load: (names) ->

    if isType names, String
      names = [names]

    assertType names, Array
    Promise.chain names, (name) =>

      @_loading[name] ?= Promise.try =>
        if loader = @_loaders[name]
        then loader.call this
        else throw Error "Loader named '#{name}' does not exist!"

      .fail (error) =>
        @_loading[name] = null
        throw error

  # Crawl the root directory for files matching the pattern.
  # For file watching, install `lotus-watch` and call the `watch` method on a `Module` instance.
  crawl: (pattern, options) ->

    if isType pattern, Object
      options = pattern
      pattern = null

    else unless isType options, Object
      options = {}

    # If no pattern is specified, find the
    # compiled source files of this module.
    unless pattern
      pattern = [path.join @path, "*.js"]
      if @dest isnt null
        pattern.push path.join @dest, "**", "*.js"

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
    if path.isAbsolute pattern
      throw Error "`pattern` must be relative"

    unless options.force
      return @_crawling[pattern] if @_crawling[pattern]

    if options.verbose
      log.moat 1
      log.white "crawl "
      log.cyan lotus.relative pattern
      log.moat 1

    pattern = path.resolve @path, pattern
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

    return unless config = @config
    {dependencies, devDependencies} = config

    if hasKeys dependencies
    then config.dependencies = sortObject dependencies
    else delete config.dependencies

    if hasKeys devDependencies
    then config.devDependencies = sortObject devDependencies
    else delete config.devDependencies

    config = JSON.stringify config, null, 2
    configPath = path.join @path, "package.json"
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
      dest = path.dirname path.join @path, @config.main
      @dest = dest if dest isnt @path
    return

  _loadPlugins: ->

    unless @config
      throw Error "Must load the 'config' first!"

    plugins = new Set

    if names = @config.plugins
      plugins.add name for name in names

    for name in lotus.modulePlugins
      plugins.add name

    loader = (plugin) =>
      plugin.initModule this

    plugins = Array.from plugins
    Promise.all plugins, (name) ->
      lotus.plugins.load name, loader

type.addMixins lotus.moduleMixins

module.exports = Module = type.build()
