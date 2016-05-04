
{ assert } = require "type-utils"

emptyFunction = require "emptyFunction"
SortedArray = require "sorted-array"
didExit = require "exit"
inArray = require "in-array"
asyncFs = require "io/async"
syncFs = require "io/sync"
Type = require "Type"
Path = require "path"
sync = require "sync"
log = require "log"
Q = require "q"

type = Type "Lotus_Cache"

type.defineValues

  path: (path) -> path

  isDirty: no

  _watcher: null

type.defineMethods

  load: (options = {}) ->

    unless syncFs.isFile @path
      error = Error "Cache does not exist!"
      return Q.reject error

    if options.reset
      log.moat 1
      log.white "Deleting: "
      log.red @path
      log.moat 1
      syncFs.remove @path
      error = Error "Cache was manually reset!"
      return Q.reject error

    log.moat 1
    log.white "Reading cache: "
    log.yellow @path
    log.moat 1

    startTime = Date.now()

    asyncFs.read @path

    .then (json) =>
      @fromJSON JSON.parse json

    .then (loadedModules) =>

      endTime = Date.now()

      log.moat 1
      log.white "Restored "
      log.green loadedModules.length
      log.white " existing modules: "
      log.moat 1

      log.plusIndent 2
      for module, index in loadedModules
        color = if index % 2 then "cyan" else "green"
        newPart = module.name + " "
        newLength = log.line.length + newPart.length
        log.moat 0 if newLength > log.size[0] - log.indent
        log[color] newPart
      log.popIndent()

      log.moat 1
      log.white "Loaded cache: "
      log.green @path, " "
      log.pink endTime - startTime, " ms"
      log.moat 1

      # Mark the cache as dirty when a file is changed!
      # @_watcher = lotus.Module.didFileChange => @isDirty = yes

      # Save the cache when the process exits!
      # didExit => @save()

  save: ->
    return Q() unless @isDirty
    @isDirty = no
    startTime = Date.now()
    @toJSON()
    .then (json) =>
      asyncFs.write @path, json
      .then =>
        endTime = Date.now()
        log.moat 1
        log.white "Saved cache: "
        log.green @path, " "
        log.pink endTime - startTime, " ms"
        log.moat 1

  toJSON: ->

    startTime = Date.now()

    modules = []
    files = []

    moduleNames = Object.keys lotus.Module.cache

    Q.all sync.map moduleNames, (name) ->

      module = lotus.Module.cache[name]

      Q.try ->
        module.toJSON()

      .then (json) ->

        return if json is no

        modules.push json

        filePaths = Object.keys module.files

        Q.all sync.map filePaths, (path) ->

          Q.try ->
            module.files[path].toJSON()

          .then (json) ->
            files.push json

    .then ->

      log.moat 1
      log.white "Cached modules: "
      log.green modules.length
      log.moat 1

      log.moat 1
      log.white "Cached files: "
      log.green files.length
      log.moat 1

      JSON.stringify { modules, files }

  fromJSON: (json) ->

    fileMap = Object.create null

    sync.each json.files, (file) ->
      fileMap[file.path] = file

    ignoredErrors = [
      "Module with that name already exists!"
      "Module path must be a directory!"
    ]

    loadedModules = SortedArray [], (a, b) ->
      a = a.module.name.toLowerCase()
      b = b.module.name.toLowerCase()
      if a > b then 1 else -1

    # Prevent spamming the terminal with errors.
    hasThrown = no

    Q.all sync.map json.modules, (module) ->

      Q.try ->
        lotus.Module.fromJSON module

      .then (result) ->
        loadedModules.insert result

      .fail (error) ->

        # TODO: Remove deleted module from cache.
        # if error.message is "Module path must be a directory!"
        #   lotus.Module._emitter.emit "file event"

        return if inArray ignoredErrors, error.message
        return if hasThrown
        hasThrown = yes
        log.moat 1
        log.white "Module failed to load: "
        log.red module.name
        log.moat 1
        log.gray error.stack
        log.moat 1

    .then ->
      sync.each loadedModules.array, ({ module, dependers }) ->
        module.dependers = sync.reduce dependers, {}, (dependers, name) ->
          dependerModule = lotus.Module.cache[name]
          dependers[name] = dependerModule if dependerModule?
          dependers

    .then ->
      ignoredErrors = [
        "This file belongs to an unknown module!"
      ]

      # Prevent spamming the terminal with errors.
      hasThrown = no

      Q.all sync.map loadedModules.array, ({ module }) ->

        Q.all sync.map module.files, (file) ->

          Q.try ->
            json = fileMap[file.path]
            assert json?, { file, reason: "File not found in 'lotus-cache.json'!" }
            lotus.File.fromJSON file, json

          .fail (error) ->
            return if inArray ignoredErrors, error.message
            return if hasThrown
            hasThrown = yes
            log.moat 1
            log.white "File error: "
            log.red Path.relative lotus.path, file.path
            log.moat 0
            log.gray error.stack
            log.moat 1

    .then ->
      Q.all sync.map loadedModules.array, ({ module }) ->
        module._loadPlugins()

    .then ->
      sync.map loadedModules.array, ({ module }) ->
        module

module.exports = type.build()
