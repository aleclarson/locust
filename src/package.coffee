
{ join, resolve, basename, isAbsolute } = require "path"
SemVer = require "semver"
define = require "define"
NamedFunction = require "named-function"
{ io, each, filter, reduce, read, readDir, isDir, isFile } = require "io"
{ log, color, ln } = require "lotus-log"
{ Gaze } = require "gaze"
merge = require "merge"
File = require "./file"
Config = require "./config"

Package = exports = NamedFunction "Package", (name) ->

  return pkg if (pkg = Package.cache[name])?

  return new Package name unless this instanceof Package

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

  Package.cache[@name] = this

define module, ->
  @options = configurable: no
  @ { exports }

define Package, ->

  @options = configurable: no
  @
    cache:
      value: {}

    startup: ->

      dir = process.env.LOTUS_PATH

      log.moat 1
      log "Reading packages from "
      log.yellow dir
      log "..."
      log.moat 1

      pkgCount = 0

      readDir dir
      
      .then (paths) =>

        paths = paths.slice 0, 8

        each paths, (path, i, done) =>

          pkg = Package join dir, path

          isDir pkg.path

          .then (isDir) =>
            
            # Set up the package's versions, dependencies, and plugins.
            return pkg.initialize() if isDir

            log.throw
              error: Error "'@culprit' is not a directory."
              culprit: pkg.path
              fatal: no
              format: ->
                opts = formatError()
                if opts.repl isnt no then opts.repl = merge opts.repl, { pkg, Package }
                opts

          .then =>
            pkgCount++
            pkg._log "finished initialization.", "green"

          .fail (error) =>
            throw error if error.fatal isnt no
            pkg._delete()
            pkg._log error.message, "red" if log.isVerbose and log.isDebug

          .fin done

          .done()

        .then ->

          log.moat 1
          log.green.dim "Found "
          log.green "#{pkgCount}"
          log.green.dim " valid packages."
          log.moat 1

define Package.prototype, ->
  @options = configurable: no, writable: no
  @
    initialize: ->
      return io.resolved() if @isInitialized
      @isInitialized = yes
      try @config = Config @path
      catch error then return io.rejected error
      io.all [ @_loadVersions(), @_loadDependencies() ]
      .then =>
        each.sync @config.plugins, (path, done) =>
          plugin = require path
          unless plugin instanceof Function
            log.throw
              error: TypeError "'@culprit' failed to export a Function."
              culprit: path
              format: ->
                repl: { plugin }
          plugin this

  @enumerable = no
  @
    initPlugin: (handler) ->


    # Loads & watches the files in the given pattern.
    # Returns a promise that is resolved after all initialization is completed.
    watchFiles: (pattern, handler) ->

      deferred = io.defer()

      pattern = join @path, pattern

      gaze = new Gaze pattern
      
      gaze.on "ready", =>

        watched = gaze.watched()
        
        paths = Object.keys watched
        
        paths = reduce.sync paths, [], (paths, dir) -> 
          paths.concat filter.sync watched[dir], (path) -> isFile.sync path
        
        files = reduce.sync paths, {}, (files, path) =>
          files[path] = ( @files[path] or @files[path] = File path, this )
          files
        
        deferred.resolve { pattern, files, watcher: gaze }

        gaze.on "all", (event, path) =>
          return unless isFile.sync path
          if event is "added" then @files[path] = File path, this
          handler event, @files[path]
          if event is "deleted" then delete @files[path]

      deferred.promise

    _delete: ->
      delete Package.cache[@name]
      # TODO: Delete any references that other packages have to this package.

    _log: (message, color) ->
      log.moat 1
      log[color] @name
      log " "
      log[color].dim message
      log.moat 1

    _loadDependencies: ->

      depCount = 0
      depDirPath = join @path, "node_modules"
      pkgJsonPath = join @path, "package.json"
      pkgJson = null

      isFile pkgJsonPath

      .then (isFile) =>
        
        # Read the "package.json" file of this Package.
        return read pkgJsonPath if isFile

        log.throw
          error: Error "'@culprit' is not a file."
          culprit: pkgJsonPath
          fatal: no
          format: =>
            repl: { pkg: this, Package }

      .then (pkgJsonRaw) =>
        pkgJson = JSON.parse pkgJsonRaw
        isDir depDirPath

      .then (isDir) =>

        # Read the "node_modules" directory of this Package.
        return readDir depDirPath if isDir

        log.throw
          error: Error "'@culprit' is not a directory."
          culprit: depDirPath
          fatal: no
          format: -> repl: { pkg: dep, Package }
      
      .then (paths) =>

        each paths, (path, i, done) =>
          
          # Ignore hidden paths and devDependencies.
          return done() if (path[0] is ".") or pkgJson.devDependencies[path]?
          
          dep = Package path
          depJsonPath = join dep.path, "package.json"
          
          isDir dep.path

          .then (isDir) =>
            
            # Check if "package.json" is a file.
            return isFile depJsonPath if isDir
            
            log.throw
              error: Error "'@culprit' is not a directory."
              culprit: dep.path
              fatal: no
              format: ->
                repl: { pkg: dep, Package }
            
          .then (isFile) =>

            # Read the contents of "package.json".
            return read depJsonPath if isFile
            
            log.throw
              error: Error "'@culprit' is not a file."
              culprit: depJsonPath
              fatal: no
              format: ->
                repl: { pkg: dep, Package }
            
          .then (contents) =>
            json = JSON.parse contents
            stat dep.path
            .then (stats) => { stats, json }

          .then ({ stats, json }) =>
            depCount++
            dep.dependers[@name] = this
            @dependencies[dep.name] =
              version: json.version
              lastModified: stats.node.mtime

          .fail (error) =>
            throw error if error.fatal isnt no
            dep._delete()
            dep._log error.message, "red" if log.isVerbose and log.isDebug

          .fin done

          .done()

      .then =>
        @_log "loaded #{depCount} dependencies!", "green"

    # Fetches the Git tags that use semantic versioning, as well as when each was last modified.
    # Watches the Git tag directory for changes in versions!
    _loadVersions: ->

      versionCount = 0
      
      tagDirPath = join @path, ".git/refs/tags"

      isDir tagDirPath

      .then (isDir) =>

        # Read the ".git/refs/tags" directory of this Package.
        return readDir tagDirPath if isDir

        log.throw
          error: Error "'@culprit' is not a directory."
          culprit: tagDirPath
          fatal: no
          format: =>
            repl: { pkg: this, Package }

      .then (paths) =>

        each paths, (tag, i, done) =>
        
          return done() unless SemVer.valid tag 
        
          stat join tagDirPath, tag

          .then (stats) =>
            versionCount++
            @versions[tag] = lastModified: stats.node.mtime
            done()

          .done()

      .then =>
        @_log "loaded #{versionCount} versions!", "green"



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
        #         # TODO: Else, log that a new version is available and list packages that might be interested.
        #
        #       when "deleted"
        #         style = "red"
        #         delete @versions[version]
        #         # TODO: Warn if any package relies on this version.
        #
        #       when "changed"
        #         style = "blue"
        #         @versions[version].lastModified = new Date
        #         # TODO: Reinstall this version for any packages that rely on it.
        #
        #     log.moat 1
        #     log color[style].dim event + " "
        #     log @name + " "
        #     log color[style] version
        #     log.moat 1
        #
        #     @emit 

formatError = ->
  stack:
    exclude: ["**/lotus-require/src/**", "**/q/q.js", "**/nimble/nimble.js"]
    filter: (frame) -> !frame.isNative() and !frame.isNode()
