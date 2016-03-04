
Lotus = require "./index"

{ sync, async } = require "io"
{ assert } = require "type-utils"

SortedArray = require "sorted-array"
inArray = require "in-array"
log = require "lotus-log"

module.exports =

  toJSON: ->
    startTime = Date.now()

    modules = []
    files = []

    moduleNames = Object.keys Lotus.Module.cache
    async.all sync.map moduleNames, (name) ->

      module = Lotus.Module.cache[name]
      async.try ->
        module.toJSON()

      .then (json) ->
        return if json is no
        modules.push json
        filePaths = Object.keys module.files
        async.all sync.map filePaths, (path) ->
          async.try -> module.files[path].toJSON()
          .then (json) -> files.push json

    .then ->

      log
        .moat 1
        .white "Saving "
        .yellow modules.length
        .white " modules..."
        .moat 1

      log
        .moat 1
        .white "Saving "
        .yellow files.length
        .white " files..."
        .moat 1

      async.write "lotus-cache.json", JSON.stringify { modules, files }

    .then ->
      log
        .moat 1
        .white "Saved "
        .yellow "lotus-cache.json"
        .white " file in "
        .green Date.now() - startTime
        .white " ms!"
        .moat 1

  fromJSON: ->

    log
      .moat 1
      .cyan "Reading the 'lotus-cache.json' file..."
      .moat 1

    startTime = Date.now()

    async.read "lotus-cache.json"

    .then (json) ->
      json = JSON.parse json
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

      async.all sync.map json.modules, (module) ->

        async.try ->
          Lotus.Module.fromJSON module

        .then (result) ->
          loadedModules.insert result

        .fail (error) ->

          # TODO: Remove deleted module from cache.
          # if error.message is "Module path must be a directory!"
          #   Lotus.Module._emitter.emit "file event"

          return if inArray ignoredErrors, error.message

          log
            .moat 1
            .white "Module failed to load: "
            .red module.name
            .moat 1
            .gray error.stack
            .moat 1

          try
            require "lotus-repl"
            log.repl.sync()

          catch error
            log.it "REPL failed: " + error.message

      .then ->
        async.each loadedModules.array, ({ module, dependers }) ->
          module.dependers = sync.reduce dependers, {}, (dependers, name) ->
            dependerModule = Lotus.Module.cache[name]
            if dependerModule?
              dependers[name] = dependerModule
            else
              error = "Failed to find depender: '#{name}'!"
              Lotus.Module._reportError { error }
            dependers

      .then ->
        ignoredErrors = [
          "This file belongs to an unknown module!"
        ]

        async.all sync.map loadedModules.array, ({ module }) ->

          async.each module.files, (file) ->

            async.try ->
              json = fileMap[file.path]
              assert json?, { file, reason: "File not found in 'lotus-cache.json'!" }
              Lotus.File.fromJSON file, json

            .fail (error) ->
              return if inArray ignoredErrors, error.message
              log
                .moat 1
                .white "File error: "
                .red file.path
                .moat 0
                .gray (if log.isVerbose then error.stack else error.message)
                .moat 1

      .then ->
        async.all sync.map loadedModules.array, ({ module }) ->
          module._loadPlugins()

      .then ->
        sync.map loadedModules.array, ({ module }) ->
          module

    .then (loadedModules) ->

      log.moat 1
      log.white "Loaded #{loadedModules.length} modules: "
      log.moat 1
      log.plusIndent 2
      for module in loadedModules
        log.green module.name
        log.moat 1
      log.popIndent()

      log
        .moat 1
        .white "Loaded cache: "
        .yellow Lotus.path + "/lotus-cache.json"
        .gray " (in #{Date.now() - startTime} ms)"
        .moat 1
