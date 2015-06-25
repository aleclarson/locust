
lotus = require "../../../lotus-require"
{ join, relative, resolve, basename, isAbsolute } = require "path"
SemVer = require "semver"
define = require "define"
NamedFunction = require "named-function"
io = require "io"
{ getType, isKind } = require "type-utils"
{ log, color, ln } = require "lotus-log"
{ Gaze } = require "gaze"
merge = require "merge"
plural = require "plural"

Config = require "./config"
File = require "./file"

Module = exports = NamedFunction "Module", (name) ->

  if (module = Module.cache[name])?
    return module 

  unless isKind this, Module
    return new Module name

  if isAbsolute name
    @path = name
    @name = basename name
  
  else
    @name = name
    @path = resolve name

  @files = {}
  @versions = {}
  @dependers = {}
  @dependencies = {}
  @isInitialized = no

  if io.isDir.sync @path

    if log.isDebug and log.isVerbose
      log.moat 1
      log "Module created: "
      log.blue @name
      log.moat 1

    Module.cache[@name] = this

  else
    @error = Error "'module.path' must be a directory."

  this

define module, ->
  @options = configurable: no
  @ { exports }

define Module, ->

  @options = configurable: no
  @
    cache:
      value: {}

    startup: ->

      dir = process.env.LOTUS_PATH

      moduleCount = 0

      io.readDir dir
      
      .then (paths) =>

        paths = paths.slice 0, 8

        io.each paths, (path) ->

          module = Module join dir, path

          io.isDir module.path

          .then (isDir) ->
            
            # Set up the module's versions, dependencies, and plugins.
            return module.initialize() if isDir

            io.throw
              fatal: no
              error: Error "'#{module.path}' is not a directory."
              code: "NOT_A_DIRECTORY"
              format: merge formatError(),
                repl: { module, Module }

          .then ->
            moduleCount++

          .fail (error) ->
            io.catch error
            module._delete()

            if log.isDebug
              _printError module.name, error

        .then ->

          if log.isDebug
            log.moat 1
            _printOrigin()
            log.yellow "#{moduleCount}"
            log " modules were initialized!"
            log.moat 1

define Module.prototype, ->
  @options = configurable: no, writable: no
  @
    initialize: ->

      return io.fulfill() if @isInitialized

      @isInitialized = yes

      try @config = Config @path

      catch error then return io.reject error

      io.all [
        @_loadVersions()
        @_loadDependencies()
      ]

      .then =>
        @config.loadPlugins (plugin, options) =>
          io.resolve plugin this, options

  @enumerable = no
  @
    # Loads & watches the files in the given pattern.
    # Returns a promise that is resolved after all initialization is completed.
    watchFiles: (options) ->

      deferred = io.defer()

      pattern = join @path, options.pattern

      gaze = new Gaze pattern
      
      gaze.on "ready", =>

        watched = gaze.watched()
        
        paths = Object.keys watched
        
        # Only use paths that point to files.
        paths = io.reduce.sync paths, [], (paths, dir) -> 
          paths.concat io.filter.sync watched[dir], (path) -> io.isFile.sync path
        
        # Create a map of File objects from the paths.
        files = io.reduce.sync paths, {}, (files, path) =>
          files[path] = File path, this
          files

        result = { pattern, files, watcher: gaze }
        
        deferred.resolve result

        options.onReady? result

        gaze.on "all", (event, path) =>
          
          return unless io.isFile.sync path

          if event is "added"
            file = File path, this
            log.repl.sync added: file
            return unless isKind options.onAdded, Function
            file.work = io.try -> options.onAdded file

          else if event is "changed"
            log.repl.sync changed: @files[path]
            return unless isKind options.onChanged, Function
            file ?= @files[path]
            file.work = file.work.then -> options.onChanged file

          else if event is "deleted"
            log.repl.sync deleted: @files[path]
            return unless isKind options.onDeleted, Function
            file ?= @files[path]
            delete @files[path]
            file.work = file.work.then -> options.onDeleted file

          # Report failures like `promise.done()` does, but still allow the promise chain to be extended.
          file.work = file.work.fail (error) -> io.catch error, log.error

      deferred.promise      

    _delete: ->
      delete Module.cache[@name]
      # TODO: Delete any references that other modules have to this module.

    _loadDependencies: ->

      depCount = 0
      depDirPath = join @path, "node_modules"
      moduleJsonPath = join @path, "package.json"
      moduleJson = null

      io.isFile moduleJsonPath

      .then (isFile) =>
        
        # Read the "package.json" file of this Module.
        return io.read moduleJsonPath if isFile

        io.throw
          fatal: no
          error: Error "'#{moduleJsonPath}' is not a file."
          code: "PACKAGE_JSON_NOT_A_FILE"
          format: => repl: { module: this, Module }

      .then (moduleJsonRaw) =>
        moduleJson = JSON.parse moduleJsonRaw
        io.isDir depDirPath

      .then (isDir) =>

        # Read the "node_modules" directory of this Module.
        return io.readDir depDirPath if isDir

        io.throw
          fatal: no
          error: Error "'#{depDirPath}' is not a directory."
          code: "NODE_MODULES_NOT_A_DIRECTORY"
          format: -> repl: { module: dep, Module }

      .then (paths) =>

        io.each paths, (path, i) =>
          
          # Ignore hidden paths and devDependencies.
          return if (path[0] is ".") or moduleJson.devDependencies[path]?
          
          dep = Module path
          depJsonPath = join dep.path, "package.json"
          
          io.isDir dep.path

          .then (isDir) =>
            
            # Check if "package.json" is a file.
            return io.isFile depJsonPath if isDir
            
            io.throw
              fatal: no
              error: Error "'#{dep.path}' is not a directory."
              code: "NOT_A_DIRECTORY"
              format: -> repl: { module: dep, Module }
            
          .then (isFile) =>

            # Read the contents of "package.json".
            return io.read depJsonPath if isFile
            
            io.throw
              fatal: no
              error: Error "'depJsonPath' is not a file."
              code: "PACKAGE_JSON_NOT_A_FILE"
              format: -> repl: { module: dep, Module }
            
          .then (contents) =>
            json = JSON.parse contents
            io.stat dep.path
            .then (stats) => { stats, json }

          .then ({ stats, json }) =>
            depCount++
            dep.dependers[@name] = this
            @dependencies[dep.name] =
              version: json.version
              lastModified: stats.node.mtime

            if log.isDebug
              log.moat 1
              _printOrigin()
              log.yellow @name
              log " depends on "
              log.yellow dep.name
              log.moat 1

          .fail (error) =>
            io.catch error
            dep._delete()
            
            if log.isDebug
              _printError @name, error

    # Fetches the Git tags that use semantic versioning, as well as when io.each was last modified.
    # Watches the Git tag directory for changes in versions!
    _loadVersions: ->

      versionCount = 0
      
      tagDirPath = join @path, ".git/refs/tags"

      io.isDir tagDirPath

      .then (isDir) =>

        # Read the ".git/refs/tags" directory of this Module.
        return io.readDir tagDirPath if isDir

        io.throw
          fatal: no
          error: Error "'#{tagDirPath}' is not a directory."
          format: =>
            repl: { module: this, Module }

      .then (paths) =>

        io.each paths, (tag, i) =>
        
          return unless SemVer.valid tag 
        
          io.stat join tagDirPath, tag

          .then (stats) =>
            versionCount++
            @versions[tag] = lastModified: stats.node.mtime

      .then =>
        
        if log.isDebug
         log.moat 1
         _printOrigin()
         log.yellow relative lotus.path, @path
         log " loaded "
         log.yellow versionCount
         log " ", plural "version", versionCount
         log.moat 1

        # gaze = new Gaze tagDirPath + "/*"
        # gaze.on "ready", =>
        #   gaze.on "all", (event, path) =>
        #
        #     version = basename path
        #     return if semver.valid(version) is null
        #
        #     switch event
        #
        #       when "added"
        #         style = "green"
        #         @versions[version] = lastModified: new Date
        #         # TODO: If `--force` was used, replace old versions with this version.
        #         # TODO: Else, log that a new version is available and list modules that might be interested.
        #
        #       when "deleted"
        #         style = "red"
        #         delete @versions[version]
        #         # TODO: Warn if any module relies on this version.
        #
        #       when "changed"
        #         style = "blue"
        #         @versions[version].lastModified = new Date
        #         # TODO: Reinstall this version for any modules that rely on it.
        #
        #     log.moat 1
        #     log color[style].dim event + " "
        #     log @name + " "
        #     log color[style] version
        #     log.moat 1
        #
        #     @emit 

_printOrigin = ->
  log.gray.dim "lotus/module "

_printError = (moduleName, error) ->
  log.moat 1
  _printOrigin()
  log.yellow moduleName
  log " "
  log.bgRed.white getType(error).name
  log ": "
  log error.message
  log.moat 1

formatError = ->
  stack:
    exclude: ["**/lotus-require/src/**", "**/q/q.js", "**/nimble/nimble.js"]
    filter: (frame) -> !frame.isNative() and !frame.isNode()

# Get the actual File constructor.
File = File.initialize Module
