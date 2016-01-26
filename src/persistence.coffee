
{ async } = require "io"
lotus = require "lotus-require"
log = require "lotus-log"

module.exports =

  toJSON: () ->

    startTime = Date.now()

    modules = []

    files = []

    async.each Module.cache, (module) ->

      async.try ->

        module.toJSON()

      .then (json) ->

        return if json is no

        modules.push json

        async.each module.files, (file, path) ->

          async.try ->

            file.toJSON()

          .then (json) ->

            files.push json

    .then ->

      async.write "lotus-cache.json", JSON.stringify { modules, files }

    .then ->

      log.origin "lotus/persistence"
      log.green "exported "
      log.yellow lotus.path + "/lotus-cache.json"
      log.gray " (in #{Date.now() - startTime} ms)"
      log.moat 1

  fromJSON: ->

    startTime = Date.now()

    async.read "lotus-cache.json"

    .then (json) ->
      json = JSON.parse json
      fileMap = Object.create null
      async.each json.files, (file) ->
        fileMap[file.path] = file
      .then ->
        modules = []
        async.each json.modules, (module) ->
          async.try -> Module.fromJSON module
          .then (module) -> modules.push module
          .fail async.catch
        .then ->
          global.modules = modules
          async.each modules, (module) ->
            async.each module.files, (file) ->
              json = fileMap[file.path]
              if json?
                File.fromJSON file, json
                return
              if log.isVerbose
                log.moat 1
                log.yellow "WARN: "
                log "File '#{file.path}' does not exist in 'lotus-cache.json'."
                log.moat 1

    .then ->
      log
        .moat 1
        .white "Loaded cache: "
        .yellow lotus.path + "/lotus-cache.json"
        .gray " (in #{Date.now() - startTime} ms)"
        .moat 1
