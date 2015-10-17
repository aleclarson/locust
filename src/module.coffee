
# TODO: Prevent same file from being processed more than once (if the thread was stalled by a prompt).
#
# TODO: Detect new directories added to $LOTUS_PATH.
#
# TODO: Watch modules that throw errors during initialization.
#       Attempt to reinitialize the module if its error is detected to be fixed.

lotus = require "lotus-require"

{ join, relative, resolve, dirname, basename, isAbsolute } = require "path"
{ getType, isKind, isType } = require "type-utils"
{ log, color, ln } = require "lotus-log"
{ EventEmitter } = require "events"
{ sync, async } = require "io"
NamedFunction = require "named-function"
{ Gaze } = require "gaze"
combine = require "combine"
inArray = require "in-array"
SemVer = require "semver"
define = require "define"
plural = require "plural"
noop = require "no-op"
has = require "has"
mm = require "micromatch"

Config = require "./config"
File = require "./file"

Module = NamedFunction "Module", (name) ->

  return Module.cache[name] if has Module.cache, name

  return new Module name unless isKind this, Module

  if (name[0] is "/") or (name[0..1] is "./")
    async.throw
      error: Error "'name' cannot start with a '.' or '/' character"
      format: repl: { name }

  path = resolve name

  if sync.isDir path

    if log.isVerbose
      log.moat 1
      log "Module created: "
      log.blue name
      log.moat 1

    Module.cache[name] = this

  else
    error = Error "'#{path}' must be a directory."

  isInitialized = no
  files = value: {}
  versions = value: {}
  dependers = value: {}
  dependencies = value: {}

  _reportedMissing = value: {}

  define this, ->
    @options = enumerable: no
    @ { _reportedMissing }

  define this, { name, path, isInitialized, files, versions, dependers, dependencies, error }

define Module, ->

  @options = configurable: no
  @
    cache:
      value: Object.create null

    initialize: ->

      moduleCount = 0

      async.readDir lotus.path

      .then (paths) =>

        async.each paths, (path) ->

          _module = Module path

          async.isDir _module.path

          .then (isDir) ->

            # Set up the module's versions, dependencies, and plugins.
            return _module.initialize() if isDir

            _module._delete()

            async.throw
              fatal: no
              error: Error "'#{_module.path}' is not a directory."
              code: "NOT_A_DIRECTORY"
              format: combine _formatError(),
                repl: { _module, Module }

          .then ->
            moduleCount++

          .fail (error) ->
            _module._onError error

      .then ->

        if log.isDebug
          log.origin "lotus/module"
          log.yellow "#{moduleCount}"
          log " modules were initialized!"
          log.moat 1

    forFile: (path) ->
      path = relative lotus.path, path
      name = dirname path.slice 0, -1 + path.indexOf "/"
      return null unless has Module.cache, name
      Module name

    fromJSON: (json) ->

      { name, files, dependers, dependencies, config } = json

      module = Module name

      if module.error?

        delete Module.cache[name]

        throw module.error

      module.isInitialized = yes

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

  @enumerable = no
  @
    _emitter: new EventEmitter

    # Watch the files that match the given 'pattern'.
    # Only the files that have been registered via 'module._watchFiles()' will be used.
    _watchFiles: (options, callback) ->
      options = include: options if isType options, String
      options.include ?= "**/*"
      Module._emitter.on "file event", ({ file, event }) ->
        return if mm(file.path, options.include).length is 0
        return if options.exclude? and mm(file.path, options.exclude).length > 0
        callback file, event, options
      return

define Module.prototype, ->
  @options = frozen: yes
  @
    initialize: ->

      return async.fulfill() if @isInitialized

      @isInitialized = yes

      @config = Config @path

      async.all [
        @_loadVersions()
        @_loadDependencies()
      ]

      .then =>
        @_loadPlugins()

    toJSON: ->

      if @error?
        if log.isVerbose
          log.moat 1
          log "'#{module.name}' threw an error: "
          log @error.message
          log.moat 1
        return no

      unless @config?
        if log.isVerbose
          log.moat 1
          log "'#{@name}' has no config file"
          log.moat 1
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

    _watchFiles: (options) ->

      deferred = async.defer()

      pattern = join @path, options.pattern

      # BUGFIX: https://github.com/shama/gaze/issues/84
      pattern = relative process.cwd(), pattern

      gaze = new Gaze pattern

      if log.isVerbose
        log.origin "lotus/module"
        log.green "watching "
        log.yellow pattern
        log.moat 1

      gaze.once "ready", =>

        watched = gaze.watched()

        paths = Object.keys watched

        # Only use paths that point to files.
        paths = sync.reduce paths, [], (paths, dir) ->
          paths.concat sync.filter watched[dir], (path) -> sync.isFile path

        # Create a map of File objects from the paths.
        files = sync.reduce paths, {}, (files, path) =>
          files[path] = File path, this
          files

        result = { pattern, files, watcher: gaze }

        deferred.resolve result

        options.onStartup? result

        if isKind options.onReady, Function
          async.each files, (file) ->
            if log.isVerbose
              log.origin "lotus/module"
              log.cyan "ready "
              log.yellow relative process.cwd(), file.path
              log.moat 1
            options.onReady file

      gaze.on "all", (event, path) =>
        event = "added" if event is "renamed"
        isValid = if event is "added" then sync.isFile path else @files[path]?
        return unless isValid
        file = File path, this
        @_onFileEvent event, file, options

      deferred.promise

    _onFileEvent: (event, file, options) =>

      log.origin "lotus/module"
      log.cyan event
      log " "
      log.yellow relative process.cwd(), file.path
      log.moat 1

      isDeleted = no

      eventQueue = file.eventQueue or async.fulfill()

      enqueue = (callback, args...) ->
        return no if !isKind callback, Function
        eventQueue = async.when eventQueue, -> callback.apply null, [file].concat args
        enqueue.wasCalled = yes

      switch event

        when "added"
          enqueue options.onReady
          enqueue options.onCreate

        when "changed"
          enqueue options.onChange

        when "deleted"
          isDeleted = yes
          file.delete()
          enqueue options.onDelete

        else
          throw Error "Unhandled file event: '#{event}'"

      enqueue options.onSave if !isDeleted

      enqueue options.onEvent, event

      Module._emitter.emit "file event", { file, event }

      if enqueue.wasCalled
        eventQueue = eventQueue.fail (error) ->
          async.catch error, ->
            log.error error

      file.eventQueue = eventQueue

    _delete: ->
      if log.isVerbose
        log.moat 1
        log "Module deleted: "
        log.red @name
        log.moat 1
      delete Module.cache[@name]
      # TODO: Delete any references that other modules have to this module.

    _loadPlugins: ->

      @config.loadPlugins (plugin, options) =>

        async.try => plugin this, options

      .fail (error) =>
        throw error if error.fatal isnt no
        log.origin "lotus/module"
        log.yellow @name
        log " has no plugins."
        log.moat 1

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

          dep = Module path
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

      .then =>
        if log.isVerbose
          log.moat 1
          log "Module '#{@name}' loaded #{depCount} dependencies"
          log.moat 1

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
      async.catch error
      _printError @name, error if log.isDebug and (log.isVerbose or not inArray Module._ignoredErrorCodes, error.code)

isInitialized = no

define exports,

  initialize: ->
    unless isInitialized
      isInitialized = yes
      File = File.initialize Module
    Module

_printError = (moduleName, error) ->
  log.origin "lotus/module"
  log.yellow moduleName
  log " "
  log.bgRed.white getType(error).name
  log ": "
  log error.message
  log.moat 1

_formatError = ->
  stack:
    exclude: ["**/lotus-require/src/**", "**/q/q.js", "**/nimble/nimble.js"]
    filter: (frame) -> !frame.isNative() and !frame.isNode()
