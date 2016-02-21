
# TODO: Prevent same file from being processed more than once (if the thread was stalled by a prompt).
#
# TODO: Detect new directories added to $LOTUS_PATH.
#
# TODO: Watch modules that throw errors during initialization.
#       Attempt to reinitialize the module if its error is detected to be fixed.

lotus = require "lotus-require"

{ join, relative, resolve, dirname, basename, isAbsolute } = require "path"
{ assert, getType, setType, isKind, isType } = require "type-utils"
{ log, color, ln } = require "lotus-log"
{ EventEmitter } = require "events"
{ sync, async } = require "io"

NamedFunction = require "named-function"
SortedArray = require "sorted-array"
chokidar = require "chokidar"
combine = require "combine"
inArray = require "in-array"
SemVer = require "semver"
define = require "define"
plural = require "plural"
noop = require "no-op"
mm = require "micromatch"

Config = require "./config"

module.exports =
global.Module = NamedFunction "Module", (name) ->

  assert (not Module.cache[name]?), { name, reason: "Module with that name already exists!" }

  assert (name[0] isnt "/") and (name[0..1] isnt "./"), { name, reason: "Module name cannot begin with `/` or `./`!" }

  path = resolve name

  assert (sync.isDir path), { path, reason: "Module path must be a directory!" }

  Module.cache[name] =
  mod = setType {}, Module

  define mod, ->

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
      _deleted: no
      _patterns: Object.create null
      _initializing: null
      _retryWatcher: null
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

    crawl: (dir) ->

      if Module.fs?
        throw Error "Already crawled."

      promises = []
      newModules = SortedArray [], (a, b) ->
        a = a.name.toLowerCase()
        b = b.name.toLowerCase()
        if a > b then 1 else -1

      fs = Module.fs = chokidar.watch dir, { depth: 0 }

      fs.on "addDir", (path) ->

        return if path is lotus.path

        name = relative lotus.path, path

        try mod = Module name
        catch error then return
        return unless mod?

        promise = async.try ->
          mod.initialize()

        .then ->
          newModules.insert mod

        .fail (error) ->
          mod._retryInitialize error

        promises.push promise

      fs.on "unlinkDir", (path) ->
        name = relative lotus.path, path
        Module.cache[name]?._delete()

      deferred = async.defer()

      fs.once "ready", ->
        async.all promises
        .then ->
          deferred.resolve newModules.array

      deferred.promise

    forFile: (path) ->
      path = relative lotus.path, path
      name = path.slice 0, path.indexOf "/"
      Module.cache[name]

    fromJSON: (json) ->

      { name, files, dependers, dependencies, config } = json

      mod = Module.cache[name]
      mod ?= Module name

      # TODO Might not want this...
      mod._initializing = async.fulfill()

      mod.config = Config.fromJSON config.path, config.json
      mod.dependencies = dependencies

      mod.files = sync.reduce files, {}, (files, path) ->
        path = resolve mod.path, path
        files[path] = File path, mod
        files

      { module: mod, dependers }

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

      @_initializing = async.try =>

        @config = Config @path

        async.all [
          @_loadVersions()
          @_loadDependencies()
        ]

      .then =>
        @_loadPlugins()

      .fail (error) =>
        @_initializing = null
        throw error

    watch: (pattern) ->

      pattern = join @path, pattern

      if @_patterns[pattern]?
        return @_patterns[pattern].adding

      fs = @_patterns[pattern] = chokidar.watch()

      deferred = async.defer()

      self = this

      files = Object.create null

      fs.on "add", onAdd = (path) ->
        return unless sync.isFile path
        files[path] = File path, self

      fs.once "ready", ->

        fs.removeListener "add", onAdd

        deferred.fulfill files

        fs.on "all", (event, path) ->
          self._onFileEvent event, path

      fs.add pattern
      fs.adding = deferred.promise

    toJSON: ->

      if @error?
        log
          .moat 1
          .red @name
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

      if event is "add"
        return unless sync.isFile path

      else
        return unless @files[path]?

      file = File path, this

      if event is "unlink"
        file.delete()

      process.nextTick ->
        Module._emitter.emit "file event", { file, event }

    _retryInitialize: (error) ->
      return if @_deleted
      silentErrors = [
        "Could not find 'lotus-config' file!"
      ]
      unless inArray silentErrors, error.message
        log
          .moat 1
          .white "Module error: "
          .red @name
          .moat 0
          .gray (if log.isVerbose then error.stack else error.message)
          .moat 1
      unless @_retryWatcher?
        @_retryWatcher = chokidar.watch @path, { depth: 1 }
        @_retryWatcher.once "ready", =>
          @_retryWatcher.on "all", (event, path) =>
            async.try =>
              @initialize()
            .then =>
              @_retryWatcher.close()
              @_retryWatcher = null
            .fail (error) =>
              @_retryInitialize error
      return

    _delete: ->

      return if @_deleted
      @_deleted = yes

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

      @config.addPlugins Module._plugins

      @config.loadPlugins (plugin, options) =>
        plugin this, options

      .fail (error) =>
        log
          .moat 1
          .white "Module error: "
          .red @name
          .moat 0
          .gray (if log.isVerbose then error.stack else error.message)
          .moat 1

    # TODO: Watch dependencies for changes.
    _loadDependencies: ->

      depCount = 0
      depDirPath = join @path, "node_modules"
      moduleJsonPath = join @path, "package.json"
      moduleJson = null

      async.isFile moduleJsonPath

      .then (isFile) =>
        assert isFile, { path: moduleJsonPath, module: this, reason: "Missing 'package.json' file!" }
        moduleJson = require moduleJsonPath
        async.isDir depDirPath

      .then (isDir) =>
        return unless isDir
        async.readDir depDirPath

      .then (names) =>
        return unless names?
        async.each names, (name, i) =>

          # Ignore hidden names.
          return if name[0] is "."

          # Ignore development dependencies.
          return if moduleJson.devDependencies?[name]?

          dep = Module.cache[name]

          try dep ?= Module name

          return unless dep?

          depJsonPath = join dep.path, "package.json"

          async.isDir dep.path

          .then (isDir) =>

            # Check if "package.json" is a file.
            return async.isFile depJsonPath if isDir

            dep._delete()

          .then (isFile) =>

            assert isFile, { path: depJsonPath, module: this, reason: "Could not find 'package.json' file!" }

            async.read depJsonPath

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
            log
              .moat 1
              .white "Dependency error: "
              .red name
              .moat 0
              .gray error.stack
              .moat 1

    # Fetches the Git tags that use semantic versioning, as well as when async.each was last modified.
    # Watches the Git tag directory for changes in versions!
    _loadVersions: ->

      versionCount = 0

      tagDirPath = join @path, ".git/refs/tags"

      async.isDir tagDirPath

      .then (isDir) =>
        return unless isDir
        async.readDir tagDirPath

      .then (tags) =>
        return unless tags?
        async.each tags, (tag, i) =>
          return unless SemVer.valid tag
          async.stats join tagDirPath, tag
          .then (stats) =>
            versionCount++
            @versions[tag] = lastModified: stats.node.mtime

      # .then =>
        # gaze = new Gaze tagDirPath + "/*"
        # gaze.on "ready", =>
        #   gaze.on "all", (event, path) =>
        #
        #     version = basename path
        #     return if semver.valid(version) is null
        #
        #     switch event
        #
        #       when "add"
        #         style = "green"
        #         @versions[version] = lastModified: new Date
        #         # TODO: If `--force` was used, replace old versions with this version.
        #         # TODO: Else, log that a new version is available and list modules that might be interested.
        #
        #       when "unlink"
        #         style = "red"
        #         delete @versions[version]
        #         # TODO: Warn if any module relies on this version.
        #
        #       when "change"
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
