
# TODO: Prevent same file from being processed more than once (if the thread was stalled by a prompt).
#
# TODO: Detect new directories added to $LOTUS_PATH.
#
# TODO: Watch modules that throw errors during initialization.
#       Attempt to reinitialize the module if its error is detected to be fixed.

lotus = require "lotus-require"

{ join, relative, resolve, dirname, basename, isAbsolute } = require "path"
{ getType, setType, isKind, isType } = require "type-utils"
{ log, color, ln } = require "lotus-log"
{ EventEmitter } = require "events"
{ sync, async } = require "io"
{ Gaze } = require "gaze"

NamedFunction = require "named-function"
combine = require "combine"
inArray = require "in-array"
SemVer = require "semver"
define = require "define"
plural = require "plural"
noop = require "no-op"
has = require "has"
mm = require "micromatch"

Config = require "./config"

module.exports =
global.Module = NamedFunction "Module", (name) ->

  return Module.cache[name] if has Module.cache, name

  if (name[0] is "/") or (name[0..1] is "./")
    async.throw
      error: Error "'name' cannot start with a '.' or '/' character"
      format: repl: { name }

  path = resolve name

  unless sync.isDir path
    throw Error "'#{path}' must be a directory."

  Module.cache[name] =
  module = setType {}, Module

  fs = new Gaze
  fs.paths = Object.create null
  fs.on "all", (event, path) ->
    module._onFileEvent event, path

  define module, ->

    @options = configurable: no
    @
      name: name
      path: path
      files: {}
      versions: {}
      dependers: {}
      dependencies: {}

    @enumerable = no
    @
      _fs: fs
      _initializing: null
      _reportedMissing: {}

define Module, ->

  @options = configurable: no
  @
    cache:
      value: Object.create null

    # Watch the files that match the given 'pattern'.
    # Only the files that have been registered via 'module.watch()' will be used.
    watch: (options, callback) ->
      options = include: options if isType options, String
      options.include ?= "**/*"
      Module._emitter.on "file event", ({ file, event }) ->
        return if mm(file.path, options.include).length is 0
        return if options.exclude? and mm(file.path, options.exclude).length > 0
        callback file, event, options
      return

    initialize: ->

      moduleCount = 0

      async.readDir lotus.path

      .then (paths) =>

        async.all sync.map paths, (path) ->

          try module = Module path

          return unless module?

          module.initialize()

          .then ->
            moduleCount++

          .fail (error) ->
            module._onError error

      .then ->
        log
          .moat 1
          .yellow moduleCount
          .white " modules were initialized!"
          .moat 1

    forFile: (path) ->
      path = relative lotus.path, path
      name = path.slice 0, path.indexOf "/"
      return null unless has Module.cache, name
      Module name

    fromJSON: (json) ->

      { name, files, dependers, dependencies, config } = json

      module = Module name

      if module.error?

        delete Module.cache[name]

        throw module.error

      module._initializing = async.fulfill()

      module.config = Config.fromJSON config.path, config.json

      module.dependencies = dependencies

      async.reduce files, {}, (files, path) ->

        path = resolve module.path, path

        files[path] = File path, module

        # TODO: Add cached files to the file watcher.
        # gaze._addToWatched path

        files

      .then (files) ->

        module.files = files

        async.reduce dependers, {}, (dependers, name) ->
          dependers[name] = Module name
          dependers

        .then (dependers) ->
          module.dependers = dependers

      .then ->
        module._loadPlugins().done()
        module

  emitter = new EventEmitter
  emitter.setMaxListeners Infinity

  @enumerable = no
  @
    _emitter: emitter

    _plugins: {}

define Module.prototype, ->
  @options = frozen: yes
  @
    initialize: ->

      return @_initializing if @_initializing

      try @config = Config @path
      catch error
        log
          .moat 1
          .red @path
          .moat 0
          .white error.message
          .moat 1
        @_delete()
        error.fatal = no
        return async.reject error

      @_initializing = async.all [
        @_loadVersions()
        @_loadDependencies()
      ]

      .then =>
        @_loadPlugins()

    watch: (pattern) ->

      pattern = join @path, pattern

      # BUGFIX: https://github.com/shama/gaze/issues/84
      pattern = relative process.cwd(), pattern

      promise = @_fs.adding or async.fulfill()

      @_fs.adding = promise.then =>

        deferred = async.defer()

        @_fs.add pattern

        @_fs.once "ready", =>
          module = this
          watched = @_fs.paths
          newFiles = sync.reduce @_fs.watched(), {}, (newFiles, paths, dir) ->
            sync.each paths, (path) ->
              return if has watched, path
              return unless sync.isFile path
              newFiles[path] = File path, module
              watched[path] = yes
            newFiles

          # log
          #   .moat 1
          #   .gray pattern
          #   .white " found "
          #   .green Object.keys(newFiles).length
          #   .white " new files!"
          #   .moat 1

          deferred.resolve newFiles

        deferred.promise

    toJSON: ->

      if @error?
        log
          .moat 1
          .red module.name
          .white " threw an error: "
          .gray @error.message
          .moat 1
        return no

      unless @config?
        return no

      config =
        path: @config.path
        json: @config.json

      files = Object.keys @files

      if files.length is 0
        if log.isVerbose
          log.moat 1
          log "'#{@name}' has no files"
          log.moat 1
        return no

      files = sync.map files, (path) => relative @path, path

      dependers = Object.keys @dependers

      { @name, files, dependers, @dependencies, config }

  @enumerable = no
  @
    _ignoredErrorCodes: [
      "NOT_A_DIRECTORY"
      "NODE_MODULES_NOT_A_DIRECTORY"
    ]

    _onFileEvent: (event, path) ->

      if event is "renamed"
        event = "added"

      if event is "added"
        return unless sync.isFile path

      else
        return unless has @files, path

      file = File path, this

      if event is "deleted"
        file.delete()

      Module._emitter.emit "file event", { file, event }

    _delete: ->
      if log.isVerbose
        log.moat 1
        log "Module deleted: "
        log.red @name
        log.moat 1
      delete Module.cache[@name]
      # TODO: Delete any references that other modules have to this module.

    _loadPlugins: ->

      @config.addPlugins Module._plugins

      @config.loadPlugins (plugin, options) =>
        plugin this, options

      .fail (error) =>
        throw error if error.fatal isnt no
        log
          .moat 1
          .yellow @name
          .white " has no plugins."
          .moat 1

    # TODO: Watch dependencies for changes.
    _loadDependencies: ->

      depCount = 0
      depDirPath = join @path, "node_modules"
      moduleJsonPath = join @path, "package.json"
      moduleJson = null

      async.isFile moduleJsonPath

      .then (isFile) =>

        if isFile
          moduleJson = require moduleJsonPath
          return async.isDir depDirPath

        @_delete()

        async.throw
          fatal: no
          error: Error "'#{moduleJsonPath}' is not a file."
          code: "PACKAGE_JSON_NOT_A_FILE"
          format: => repl: { _module: this, Module }

      .then (isDir) =>

        # Read the "node_modules" directory of this Module.
        return async.readDir depDirPath if isDir

        async.throw
          fatal: no
          error: Error "'#{depDirPath}' is not a directory."
          code: "NODE_MODULES_NOT_A_DIRECTORY"
          format: -> repl: { _module: dep, Module }

      .then (paths) =>

        async.each paths, (path, i) =>

          # Ignore hidden paths.
          return if path[0] is "."

          # Ignore development dependencies.
          return if moduleJson.devDependencies?[path]?

          try dep = Module path

          return unless dep?

          depJsonPath = join dep.path, "package.json"

          async.isDir dep.path

          .then (isDir) =>

            # Check if "package.json" is a file.
            return async.isFile depJsonPath if isDir

            dep._delete()

            async.throw
              fatal: no
              error: Error "'#{dep.path}' is not a directory."
              code: "NOT_A_DIRECTORY"
              format: -> repl: { _module: dep, Module }

          .then (isFile) =>

            # Read the contents of "package.json".
            return async.read depJsonPath if isFile

            dep._delete()

            async.throw
              fatal: no
              error: Error "'#{depJsonPath}' is not a file."
              code: "PACKAGE_JSON_NOT_A_FILE"
              format: -> repl: { module: dep, Module }

          .then (contents) =>
            json = JSON.parse contents
            async.stats dep.path
            .then (stats) => { stats, json }

          .then ({ stats, json }) =>
            depCount++
            dep.dependers[@name] = this
            @dependencies[dep.name] =
              version: json.version
              lastModified: stats.node.mtime

            if log.isDebug
              log.origin "lotus/module"
              log.yellow @name
              log " depends on "
              log.yellow dep.name
              log.moat 1

          # Handle errors for this dependency.
          .fail (error) ->
            dep._onError error

      # .then =>
      #   if log.isVerbose
      #     log.moat 1
      #     log "Module '#{@name}' loaded #{depCount} dependencies"
      #     log.moat 1

      # Handle errors for this module.
      .fail (error) =>
        @_onError error

    # Fetches the Git tags that use semantic versioning, as well as when async.each was last modified.
    # Watches the Git tag directory for changes in versions!
    _loadVersions: ->

      versionCount = 0

      tagDirPath = join @path, ".git/refs/tags"

      async.isDir tagDirPath

      .then (isDir) =>

        # Read the ".git/refs/tags" directory of this Module.
        return async.readDir tagDirPath if isDir

        async.throw
          fatal: no
          error: Error "'#{tagDirPath}' is not a directory."
          format: =>
            repl: { _module: this, Module }

      .then (paths) =>

        async.each paths, (tag, i) =>

          return unless SemVer.valid tag

          async.stats join tagDirPath, tag

          .then (stats) =>
            versionCount++
            @versions[tag] = lastModified: stats.node.mtime

      .then =>

        if log.isDebug
          log.origin "lotus/module"
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

    _onError: (error) ->
      return if inArray Module._ignoredErrorCodes, error.code
      async.catch error
